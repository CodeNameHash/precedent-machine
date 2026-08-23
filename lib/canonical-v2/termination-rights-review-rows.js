const { createHash } = require('node:crypto');

class TerminationRightsReviewRowsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TerminationRightsReviewRowsError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new TerminationRightsReviewRowsError(code, message);
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_REVIEW_INPUT', `${label} must be an object.`);
  }
  return value;
}

function exactKeys(value, keys, label) {
  object(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
      || actual.some((key, index) => key !== expected[index])) {
    fail('INVALID_REVIEW_INPUT', `${label} fields do not match the public interface.`);
  }
}

function array(value, label) {
  if (!Array.isArray(value)) fail('INVALID_REVIEW_INPUT', `${label} must be an array.`);
  return value;
}

function text(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_REVIEW_INPUT', `${label} must be a non-empty string.`);
  }
  return value;
}

function indexUnique(values, key, label) {
  const result = new Map();
  for (const value of values) {
    object(value, label);
    const id = text(value[key], `${label} ${key}`);
    if (result.has(id)) fail('REVIEW_JOIN_DRIFT', `${label} repeats ${id}.`);
    result.set(id, value);
  }
  return result;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function terminationRightProfile(profile) {
  return profile.family_key === 'TERMINATION'
    && Array.isArray(profile.subtype_path)
    && profile.subtype_path.includes('TERMINATION_RIGHT');
}

function effectIndex(candidateSets) {
  const effects = new Map();
  let ordinal = 0;
  for (const candidateSet of array(candidateSets, 'analysis candidate_sets')) {
    for (const effect of array(candidateSet?.effects, 'candidate effects')) {
      object(effect, 'candidate effect');
      const effectId = text(effect.effect_id, 'candidate effect ID');
      if (effects.has(effectId)) fail('REVIEW_JOIN_DRIFT', `effect ${effectId} is duplicated.`);
      const sourceSpanIds = array(effect.source_span_ids, 'effect source spans');
      sourceSpanIds.forEach((spanId) => text(spanId, 'effect source span ID'));
      effects.set(effectId, { effect, ordinal });
      ordinal += 1;
    }
  }
  return effects;
}

function reviewIssuesByRule(projection) {
  const issuesByRule = new Map();
  for (const reviewRow of array(projection.review_rows, 'projection review_rows')) {
    object(reviewRow, 'projection review row');
    const dispositionId = text(reviewRow.disposition_id, 'review disposition ID');
    const occurrenceId = text(reviewRow.input_occurrence_id, 'review occurrence ID');
    for (const issue of array(reviewRow.issues, 'projection review issues')) {
      object(issue, 'projection review issue');
      if (issue.rule_id === null) continue;
      const ruleId = text(issue.rule_id, 'issue rule ID');
      const effectId = text(issue.effect_id, 'issue effect ID');
      const key = `${effectId}\0${ruleId}`;
      const entry = issuesByRule.get(key) ?? {
        disposition_id: dispositionId,
        input_occurrence_id: occurrenceId,
        issues: [],
      };
      if (entry.disposition_id !== dispositionId || entry.input_occurrence_id !== occurrenceId) {
        fail('REVIEW_JOIN_DRIFT', `rule ${ruleId} is claimed by two review dispositions.`);
      }
      entry.issues.push(issue);
      issuesByRule.set(key, entry);
    }
  }
  return issuesByRule;
}

function normalRowsByRule(projection) {
  const rows = array(projection.rows, 'projection rows');
  for (const row of rows) {
    object(row, 'projection row');
    if (typeof row.row_id !== 'string' || row.row_id.length === 0) {
      fail('REVIEW_JOIN_DRIFT', 'a normal projection row has no canonical row ID.');
    }
  }
  return indexUnique(rows, 'rule_id', 'projection row');
}

function issueIdentity(issue, label) {
  object(issue, label);
  const ruleId = issue.rule_id === null ? null : text(issue.rule_id, `${label} rule ID`);
  return JSON.stringify([
    text(issue.effect_id, `${label} effect ID`),
    ruleId,
    text(issue.issue_code, `${label} code`),
    text(issue.extraction_state, `${label} extraction state`),
    text(issue.source_quality, `${label} source quality`),
    array(issue.source_span_ids, `${label} source spans`)
      .map((spanId) => text(spanId, `${label} source span ID`)),
  ]);
}

function requireCanonicalIssues(reviewRow, disposition) {
  const projected = array(reviewRow.issues, 'projection review issues')
    .map((issue) => issueIdentity(issue, 'projection review issue'))
    .sort();
  const canonical = array(disposition.issues, 'analysis disposition issues')
    .map((issue) => issueIdentity(issue, 'analysis disposition issue'))
    .sort();
  if (projected.length !== canonical.length
      || projected.some((identity, index) => identity !== canonical[index])) {
    fail('REVIEW_JOIN_DRIFT', 'projection review issues do not match canonical Analysis.');
  }
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('REVIEW_SOURCE_DRIFT', `${label} must be a safe non-negative integer.`);
  }
  return value;
}

function optionalText(value, label) {
  if (value === null || value === undefined) return null;
  return text(value, label);
}

function buildRichSourceIndex(analysis, agreementIndexes) {
  const indexes = indexUnique(
    array(agreementIndexes, 'agreement indexes'),
    'agreement_index_id', 'agreement index',
  );
  const indexBytes = new Map();
  const nodesByIndex = new Map();
  const nodeSources = new Map();
  for (const [agreementIndexId, agreementIndex] of indexes) {
    if (agreementIndex.schema_version !== 'AGREEMENT_INDEX/V1') {
      fail('REVIEW_SOURCE_DRIFT', `agreement index ${agreementIndexId} has the wrong schema.`);
    }
    const canonicalText = agreementIndex.source_binding?.canonical_text;
    if (typeof canonicalText !== 'string') {
      fail('REVIEW_SOURCE_DRIFT', `agreement index ${agreementIndexId} has no canonical text.`);
    }
    const bytes = Buffer.from(canonicalText, 'utf8');
    if (bytes.toString('utf8') !== canonicalText) {
      fail('REVIEW_SOURCE_DRIFT', `agreement index ${agreementIndexId} is not exact UTF-8 text.`);
    }
    indexBytes.set(agreementIndexId, bytes);
    const nodes = indexUnique(
      array(agreementIndex.nodes, `agreement index ${agreementIndexId} nodes`),
      'node_occurrence_id', `agreement index ${agreementIndexId} node`,
    );
    nodesByIndex.set(agreementIndexId, nodes);
    for (const node of nodes.values()) {
      const nodeId = node.node_occurrence_id;
      if (nodeSources.has(nodeId)) {
        fail('REVIEW_SOURCE_DRIFT', `source node ${nodeId} is duplicated.`);
      }
      const extent = object(node.extent_span, `source node ${nodeId} extent`);
      const startByte = safeInteger(extent.start_byte, `source node ${nodeId} start byte`);
      const endByte = safeInteger(extent.end_byte, `source node ${nodeId} end byte`);
      if (endByte <= startByte || endByte > bytes.length
          || extent.text_sha256 !== sha256Bytes(bytes.subarray(startByte, endByte))) {
        fail('REVIEW_SOURCE_DRIFT', `source node ${nodeId} has stale exact text.`);
      }
      nodeSources.set(nodeId, { agreement_index_id: agreementIndexId, bytes, node });
    }
  }

  const closures = indexUnique(
    array(analysis.source_closures, 'analysis source closures'),
    'source_closure_id', 'source closure',
  );
  const spans = new Map();
  const sourceByClosure = new Map();
  for (const closure of closures.values()) {
    const binding = object(closure.agreement_index_binding, 'source closure agreement index binding');
    const agreementIndexId = text(binding.record_id, 'source closure agreement index ID');
    const agreementIndex = indexes.get(agreementIndexId);
    const bytes = indexBytes.get(agreementIndexId);
    if (!agreementIndex || binding.record_id_field !== 'agreement_index_id') {
      fail('REVIEW_SOURCE_DRIFT', `source closure ${closure.source_closure_id} has no bound Agreement Index.`);
    }
    const nodeId = text(closure.source_node_occurrence_id, 'source closure node ID');
    const node = nodesByIndex.get(agreementIndexId).get(nodeId);
    if (!node) {
      fail('REVIEW_SOURCE_DRIFT', `source closure ${closure.source_closure_id} has no bound source node.`);
    }
    const startByte = safeInteger(closure.governing_start_byte, 'source closure start byte');
    const endByte = safeInteger(closure.governing_end_byte, 'source closure end byte');
    const extent = object(node.extent_span, 'source node extent');
    if (endByte <= startByte || endByte > bytes.length
        || extent.start_byte !== startByte || extent.end_byte !== endByte) {
      fail('REVIEW_SOURCE_DRIFT', `source closure ${closure.source_closure_id} differs from its complete node extent.`);
    }
    const fullBytes = bytes.subarray(startByte, endByte);
    if (extent.text_sha256 !== sha256Bytes(fullBytes)) {
      fail('REVIEW_SOURCE_DRIFT', `source closure ${closure.source_closure_id} complete text hash is stale.`);
    }
    sourceByClosure.set(closure.source_closure_id, {
      agreement_index_id: agreementIndexId,
      bytes,
      closure,
      node,
    });
    for (const span of array(closure.spans, `source closure ${closure.source_closure_id} spans`)) {
      object(span, 'source span');
      const spanId = text(span.span_id, 'source span ID');
      if (spans.has(spanId)) fail('REVIEW_SOURCE_DRIFT', `source span ${spanId} is duplicated.`);
      const spanStart = safeInteger(span.start_byte, 'source span start byte');
      const spanEnd = safeInteger(span.end_byte, 'source span end byte');
      if (span.source_node_occurrence_id !== nodeId
          || spanStart < startByte || spanEnd <= spanStart || spanEnd > endByte) {
        fail('REVIEW_SOURCE_DRIFT', `source span ${spanId} falls outside its complete provision.`);
      }
      const spanBytes = bytes.subarray(spanStart, spanEnd);
      if (span.text_sha256 !== sha256Bytes(spanBytes)) {
        fail('REVIEW_SOURCE_DRIFT', `source span ${spanId} text hash is stale.`);
      }
      spans.set(spanId, {
        agreement_index_id: agreementIndexId,
        closure_id: closure.source_closure_id,
        node_id: nodeId,
        span,
        quote: spanBytes.toString('utf8'),
      });
    }
  }
  return { closures, spans, sourceByClosure, nodeSources };
}

function selector(startByte, endByte, textSha256) {
  return {
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte: startByte,
    end_byte: endByte,
    text_sha256: textSha256,
  };
}

function completeProvision(sourceIndex, closureId, location = 'PRIMARY') {
  const source = sourceIndex.sourceByClosure.get(closureId);
  if (!source) fail('REVIEW_SOURCE_DRIFT', `source closure ${closureId} is absent.`);
  const { closure, node, bytes } = source;
  const startByte = closure.governing_start_byte;
  const endByte = closure.governing_end_byte;
  const exactBytes = bytes.subarray(startByte, endByte);
  return {
    location,
    source_reference: optionalText(
      node.reference ?? node.printed_reference ?? node.section_reference ?? null,
      'source reference',
    ),
    agreement_index_id: source.agreement_index_id,
    source_node_occurrence_id: closure.source_node_occurrence_id,
    selector: selector(startByte, endByte, sha256Bytes(exactBytes)),
    exact_text: exactBytes.toString('utf8'),
  };
}

function linkedProvision(sourceIndex, dependency, ownerClosureId) {
  if (dependency.state !== 'RESOLVED') {
    fail('REVIEW_SOURCE_DRIFT', `dependency ${dependency.dependency_id} is not resolved.`);
  }
  const source = sourceIndex.nodeSources.get(dependency.target_id);
  if (!source) {
    fail('REVIEW_SOURCE_DRIFT', `dependency ${dependency.dependency_id} has no exact target provision.`);
  }
  const { node, bytes } = source;
  const startByte = node.extent_span.start_byte;
  const endByte = node.extent_span.end_byte;
  const exactBytes = bytes.subarray(startByte, endByte);
  return {
    location: 'LINKED',
    dependency_id: dependency.dependency_id,
    dependency_type: text(dependency.dependency_type, 'dependency type'),
    source_reference: optionalText(
      node.reference ?? node.printed_reference ?? node.section_reference ?? null,
      'linked source reference',
    ),
    agreement_index_id: source.agreement_index_id,
    source_node_occurrence_id: node.node_occurrence_id,
    selector: selector(startByte, endByte, sha256Bytes(exactBytes)),
    exact_text: exactBytes.toString('utf8'),
    evidence_parts: evidenceParts(
      sourceIndex,
      array(dependency.source_support_ids, `dependency ${dependency.dependency_id} source supports`),
      ownerClosureId,
    ),
  };
}

function dependencyReference(sourceIndex, dependency, ownerClosureId) {
  if (!['RESOLVED', 'UNRESOLVED', 'AMBIGUOUS'].includes(dependency.state)
      || (dependency.state === 'RESOLVED' && dependency.target_id === null)
      || (dependency.target_id !== null && (
        typeof dependency.target_id !== 'string' || dependency.target_id.length === 0
      ))) {
    fail('REVIEW_SOURCE_DRIFT', `dependency ${dependency.dependency_id} has an invalid state.`);
  }
  return {
    dependency_id: dependency.dependency_id,
    dependency_type: text(dependency.dependency_type, 'dependency type'),
    state: dependency.state,
    target_id: dependency.target_id,
    evidence_parts: evidenceParts(
      sourceIndex,
      array(dependency.source_support_ids, `dependency ${dependency.dependency_id} source supports`),
      ownerClosureId,
    ),
  };
}

function evidenceParts(sourceIndex, spanIds, ownerClosureId, location = 'PRIMARY') {
  return array(spanIds, 'evidence span IDs').map((spanId) => {
    text(spanId, 'evidence span ID');
    const source = sourceIndex.spans.get(spanId);
    if (!source || source.closure_id !== ownerClosureId) {
      fail('REVIEW_SOURCE_DRIFT', `evidence span ${spanId} does not belong to its rule.`);
    }
    return {
      location,
      agreement_index_id: source.agreement_index_id,
      source_node_occurrence_id: source.node_id,
      selector: selector(
        source.span.start_byte,
        source.span.end_byte,
        source.span.text_sha256,
      ),
      quote: source.quote,
    };
  });
}

function richRuleBuilder({
  analysis,
  sourceIndex,
  profiles,
  rules,
  facts,
  expressions,
  dependencies,
  ownershipLinks,
  dimensionReviewsByRule,
  factGroupsByRule,
  ungroupedFactIdsByRule,
}) {
  const buildingRules = new Set();
  const builtRules = new Map();

  function factNode(factId, ownerRule) {
    const fact = facts.get(factId);
    if (!fact || fact.owner_rule_id !== ownerRule.rule_id
        || !ownerRule.fact_ids.includes(factId)) {
      fail('REVIEW_TREE_DRIFT', `fact ${factId} does not belong to rule ${ownerRule.rule_id}.`);
    }
    return {
      kind: 'FACT',
      fact_id: fact.fact_id,
      field_key: text(fact.field_key, `fact ${factId} field key`),
      value_type: text(fact.value_type, `fact ${factId} value type`),
      typed_value: structuredClone(fact.typed_value),
      materiality: text(fact.materiality, `fact ${factId} materiality`),
      evidence_parts: evidenceParts(
        sourceIndex,
        array(fact.source_support_ids, `fact ${factId} source supports`),
        ownerRule.source_closure_id,
      ),
    };
  }

  function expressionNode(expressionId, ownerRule, expectedParent, visiting) {
    if (visiting.has(expressionId)) {
      fail('REVIEW_TREE_DRIFT', `expression ${expressionId} is cyclic.`);
    }
    const expression = expressions.get(expressionId);
    if (!expression || expression.parent_expression_id !== expectedParent) {
      fail('REVIEW_TREE_DRIFT', `expression ${expressionId} has the wrong parent.`);
    }
    visiting.add(expressionId);
    const children = array(expression.children, `expression ${expressionId} children`)
      .map((entry, index) => {
        object(entry, `expression ${expressionId} child`);
        if (entry.ordinal !== index + 1) {
          fail('REVIEW_TREE_DRIFT', `expression ${expressionId} child order is not canonical.`);
        }
        text(entry.role, `expression ${expressionId} child role`);
        let node;
        if (entry.kind === 'FACT') {
          node = factNode(entry.id, ownerRule);
        } else if (entry.kind === 'EXPRESSION') {
          node = expressionNode(entry.id, ownerRule, expressionId, visiting);
        } else if (entry.kind === 'RULE') {
          const childRule = rules.get(entry.id);
          if (!childRule || !ownerRule.child_rule_ids.includes(entry.id)) {
            fail('REVIEW_TREE_DRIFT', `expression ${expressionId} cites an unlinked child rule.`);
          }
          const childProfile = profiles.get(childRule.profile_id);
          if (!childProfile) fail('REVIEW_TREE_DRIFT', `child rule ${entry.id} has no profile.`);
          node = {
            kind: 'RULE',
            rule_id: childRule.rule_id,
            profile_id: childRule.profile_id,
            profile_key: text(childProfile.profile_key, `child rule ${entry.id} profile key`),
            subtype_path: [...array(childProfile.subtype_path, `child rule ${entry.id} subtype path`)],
          };
        } else {
          fail('REVIEW_TREE_DRIFT', `expression ${expressionId} child kind is invalid.`);
        }
        return { kind: entry.kind, ordinal: entry.ordinal, role: entry.role, node };
      });
    visiting.delete(expressionId);
    return {
      expression_id: expressionId,
      operator: text(expression.operator, `expression ${expressionId} operator`),
      result_kind: text(expression.result_kind, `expression ${expressionId} result kind`),
      connective_evidence_parts: evidenceParts(
        sourceIndex,
        [
          ...array(expression.connective_span_ids, `expression ${expressionId} connective spans`),
          ...array(expression.authored_limb_marker_span_ids,
            `expression ${expressionId} authored limb spans`),
        ],
        ownerRule.source_closure_id,
      ),
      children,
    };
  }

  function buildRule(ruleId) {
    if (builtRules.has(ruleId)) return builtRules.get(ruleId);
    if (buildingRules.has(ruleId)) fail('REVIEW_TREE_DRIFT', `child rule ${ruleId} is cyclic.`);
    const rule = rules.get(ruleId);
    if (!rule) fail('REVIEW_TREE_DRIFT', `rule ${ruleId} is absent.`);
    const profile = profiles.get(rule.profile_id);
    if (!profile) fail('REVIEW_TREE_DRIFT', `rule ${ruleId} has no profile.`);
    buildingRules.add(ruleId);
    const childRules = array(rule.child_rule_ids, `rule ${ruleId} child rules`)
      .map((childRuleId) => buildRule(text(childRuleId, `rule ${ruleId} child rule ID`)));
    const closure = sourceIndex.closures.get(rule.source_closure_id);
    if (!closure) fail('REVIEW_SOURCE_DRIFT', `rule ${ruleId} has no source closure.`);
    const dependencyIds = [];
    const seenDependencyIds = new Set();
    for (const dependencyId of [
      ...array(closure.required_dependency_ids, `rule ${ruleId} required dependencies`),
      ...array(rule.fact_ids, `rule ${ruleId} fact IDs`).flatMap((factId) => (
        array(facts.get(factId)?.dependency_ids ?? [], `fact ${factId} dependencies`)
      )),
    ]) {
      text(dependencyId, `rule ${ruleId} dependency ID`);
      if (!seenDependencyIds.has(dependencyId)) {
        seenDependencyIds.add(dependencyId);
        dependencyIds.push(dependencyId);
      }
    }
    const dependencyProvisions = [];
    const dependencyReferences = [];
    for (const dependencyId of dependencyIds) {
      const dependency = dependencies.get(dependencyId);
      if (!dependency) fail('REVIEW_SOURCE_DRIFT', `dependency ${dependencyId} is absent.`);
      const hasExactTargetProvision = dependency.state === 'RESOLVED'
        && sourceIndex.nodeSources.has(dependency.target_id);
      if (hasExactTargetProvision) {
        dependencyProvisions.push(
          linkedProvision(sourceIndex, dependency, rule.source_closure_id),
        );
      } else {
        dependencyReferences.push(
          dependencyReference(sourceIndex, dependency, rule.source_closure_id),
        );
      }
    }
    const dimensionReviews = dimensionReviewsByRule.get(ruleId) ?? [];
    const ownershipProvisions = dimensionReviews.flatMap((review) => {
      if (review.ownership_link_id === undefined) return [];
      const link = ownershipLinks.get(review.ownership_link_id);
      const ownerRule = rules.get(link?.owner_rule_id);
      const ownerFact = facts.get(link?.owner_fact_id);
      if (!link || !ownerRule || !ownerFact || ownerFact.owner_rule_id !== ownerRule.rule_id) {
        fail('REVIEW_TREE_DRIFT', `ownership link ${review.ownership_link_id} is stale.`);
      }
      return [{
        ...completeProvision(sourceIndex, ownerRule.source_closure_id, 'LINKED'),
        ownership_link_id: link.link_id,
        owner_rule_id: ownerRule.rule_id,
        owner_fact_id: ownerFact.fact_id,
      }];
    });
    const linkedProvisions = [];
    for (const provision of [
      ...dependencyProvisions,
      ...ownershipProvisions,
      ...childRules.map((childRule) => ({
        ...structuredClone(childRule.full_provision),
        location: 'LINKED',
      })),
    ]) {
      const alreadyLinked = linkedProvisions.some((linked) => (
        linked.agreement_index_id === provision.agreement_index_id
          && linked.source_node_occurrence_id === provision.source_node_occurrence_id
          && linked.selector.start_byte === provision.selector.start_byte
          && linked.selector.end_byte === provision.selector.end_byte
          && linked.selector.text_sha256 === provision.selector.text_sha256
      ));
      if (!alreadyLinked) linkedProvisions.push(provision);
    }
    const result = {
      rule_id: rule.rule_id,
      profile_id: rule.profile_id,
      profile_key: text(profile.profile_key, `rule ${ruleId} profile key`),
      subtype_path: [...array(profile.subtype_path, `rule ${ruleId} subtype path`)],
      fact_ids: [...array(rule.fact_ids, `rule ${ruleId} fact IDs`)],
      full_provision: completeProvision(sourceIndex, rule.source_closure_id),
      linked_provisions: linkedProvisions,
      dependency_references: dependencyReferences,
      expression_tree: expressionNode(
        text(rule.root_expression_id, `rule ${ruleId} root expression`),
        rule,
        null,
        new Set(),
      ),
      child_rules: childRules,
      fact_groups: factGroupsByRule.get(ruleId) ?? [],
      ungrouped_fact_ids: ungroupedFactIdsByRule.get(ruleId) ?? [],
      dimension_reviews: dimensionReviews,
      decision_review_required: dimensionReviews.length > 0
        || childRules.some((childRule) => childRule.decision_review_required),
    };
    buildingRules.delete(ruleId);
    builtRules.set(ruleId, result);
    return result;
  }

  return buildRule;
}

function delegatedDimensionOwner(profile, dimensionKey, rule, ownershipLinks, facts, rules) {
  const dispositions = profile.excluded_or_delegated_dimensions === undefined
    ? []
    : array(
      profile.excluded_or_delegated_dimensions,
      `profile ${profile.profile_id} dimension dispositions`,
    );
  const delegated = dispositions.filter((dimension) => (
    dimension?.dimension_key === dimensionKey && dimension.disposition === 'DELEGATED'
  ));
  if (delegated.length > 1) {
    fail('REVIEW_TREE_DRIFT', `dimension ${dimensionKey} has two delegated owners.`);
  }
  if (delegated.length === 0) return null;

  const [dimension] = delegated;
  const matchingLinks = array(rule.consumer_link_ids, `rule ${rule.rule_id} consumer links`)
    .map((linkId) => {
      text(linkId, `rule ${rule.rule_id} consumer link ID`);
      const link = ownershipLinks.get(linkId);
      if (!link || link.consumer_rule_id !== rule.rule_id) {
        fail('REVIEW_TREE_DRIFT', `rule ${rule.rule_id} has an invalid consumer link.`);
      }
      const ownerRule = rules.get(link.owner_rule_id);
      const ownerFact = facts.get(link.owner_fact_id);
      return { link, ownerRule, ownerFact };
    })
    .filter(({ ownerRule, ownerFact }) => (
      ownerRule?.profile_id === dimension.owner_profile_id
        && ownerFact?.field_key === dimension.owner_field_key
    ));
  if (matchingLinks.length !== 1) {
    fail(
      'REVIEW_TREE_DRIFT',
      `delegated dimension ${dimensionKey} lacks one exact ownership link.`,
    );
  }
  const binding = matchingLinks[0];
  const ownerSupports = array(
    binding.ownerFact.source_support_ids,
    `fact ${binding.ownerFact.fact_id} source supports`,
  );
  const linkSupports = array(
    binding.link.source_support_ids,
    `ownership link ${binding.link.link_id} source supports`,
  );
  if (binding.ownerFact.owner_rule_id !== binding.ownerRule.rule_id
      || ownerSupports.length !== linkSupports.length
      || ownerSupports.some((spanId, index) => spanId !== linkSupports[index])) {
    fail('REVIEW_TREE_DRIFT', `delegated dimension ${dimensionKey} has a stale owner trace.`);
  }
  return binding;
}

function buildOpenDimensionReviews(
  reviewState,
  publicRows,
  profiles,
  facts,
  sourceIndex,
  rules,
  ownershipLinks,
) {
  const keys = array(reviewState.open_review_keys, 'open review keys');
  const seen = new Set();
  const byRule = new Map(publicRows.map((row) => [row.rule_id, []]));
  for (const reviewKey of keys) {
    text(reviewKey, 'open review key');
    if (seen.has(reviewKey)) fail('REVIEW_STATE_DRIFT', `open review key ${reviewKey} repeats.`);
    seen.add(reviewKey);
    const separator = reviewKey.indexOf('::');
    const profileKey = separator < 1 ? '' : reviewKey.slice(0, separator);
    const dimensionKey = separator < 1 ? '' : reviewKey.slice(separator + 2);
    if (!profileKey || !dimensionKey) {
      fail('REVIEW_STATE_DRIFT', `open review key ${reviewKey} is invalid.`);
    }
    const matches = publicRows.filter((row) => row.profile_key === profileKey);
    if (matches.length === 0) {
      fail('REVIEW_STATE_DRIFT', `open review key ${reviewKey} selects no proposition.`);
    }
    for (const row of matches) {
      const profile = profiles.get(row.profile_id);
      const knownDimensions = array(
        profile?.known_relevant_dimensions,
        `profile ${row.profile_id} known dimensions`,
      );
      if (!knownDimensions.some((dimension) => (
        dimension?.dimension_key === dimensionKey
      ))) {
        fail(
          'REVIEW_STATE_DRIFT',
          `open review key ${reviewKey} is outside its profile dimension inventory.`,
        );
      }
      const rule = rules.get(row.rule_id);
      const matchingFacts = rule.fact_ids.map((factId) => facts.get(factId)).filter(
        (fact) => fact?.field_key === dimensionKey,
      );
      const delegatedOwner = delegatedDimensionOwner(
        profile, dimensionKey, rule, ownershipLinks, facts, rules,
      );
      if (delegatedOwner !== null && matchingFacts.length > 0) {
        fail('REVIEW_TREE_DRIFT', `delegated dimension ${dimensionKey} also has a local fact.`);
      }
      const reviewFacts = delegatedOwner === null
        ? matchingFacts : [delegatedOwner.ownerFact];
      const reviewOwnerRule = delegatedOwner === null
        ? rule : delegatedOwner.ownerRule;
      const review = {
        review_key: reviewKey,
        dimension_key: dimensionKey,
        state: 'OPEN',
        fact_ids: reviewFacts.map((fact) => fact.fact_id),
        evidence_parts: [
          ...(delegatedOwner === null ? [] : evidenceParts(
            sourceIndex,
            delegatedOwner.link.consumer_reference_span_ids,
            rule.source_closure_id,
          )),
          ...reviewFacts.flatMap((fact) => evidenceParts(
            sourceIndex,
            fact.source_support_ids,
            reviewOwnerRule.source_closure_id,
            delegatedOwner === null ? 'PRIMARY' : 'LINKED',
          )),
        ],
      };
      if (delegatedOwner !== null) review.ownership_link_id = delegatedOwner.link.link_id;
      byRule.get(row.rule_id).push(review);
    }
  }
  return byRule;
}

function buildFactGroupLayouts(reviewState, publicRows, profiles, rules, facts) {
  const groups = array(reviewState.fact_groups, 'fact groups');
  const factGroupsByRule = new Map(publicRows.map((row) => [row.rule_id, []]));
  const assignedFactIdsByRule = new Map(publicRows.map((row) => [row.rule_id, new Set()]));
  const groupKeys = new Set();
  const memberOwners = new Map();

  for (const group of groups) {
    exactKeys(
      group,
      ['group_key', 'profile_key', 'label', 'member_field_keys'],
      'fact group',
    );
    const groupKey = text(group.group_key, 'fact group key');
    const profileKey = text(group.profile_key, `fact group ${groupKey} profile key`);
    const label = text(group.label, `fact group ${groupKey} label`);
    const memberFieldKeys = array(
      group.member_field_keys,
      `fact group ${groupKey} member field keys`,
    ).map((fieldKey) => text(fieldKey, `fact group ${groupKey} member field key`));
    if (groupKeys.has(groupKey) || memberFieldKeys.length === 0) {
      fail('REVIEW_STATE_DRIFT', `fact group ${groupKey} is duplicated or empty.`);
    }
    groupKeys.add(groupKey);
    const localMembers = new Set();
    for (const fieldKey of memberFieldKeys) {
      const ownerKey = `${profileKey}\0${fieldKey}`;
      if (localMembers.has(fieldKey) || memberOwners.has(ownerKey)) {
        fail('REVIEW_STATE_DRIFT', `fact group member ${fieldKey} overlaps.`);
      }
      localMembers.add(fieldKey);
      memberOwners.set(ownerKey, groupKey);
    }

    const matches = publicRows.filter((row) => row.profile_key === profileKey);
    if (matches.length === 0) {
      fail('REVIEW_STATE_DRIFT', `fact group ${groupKey} selects no proposition.`);
    }
    for (const row of matches) {
      const profile = profiles.get(row.profile_id);
      const knownDimensions = new Set(array(
        profile?.known_relevant_dimensions,
        `profile ${row.profile_id} known dimensions`,
      ).map((dimension) => text(
        dimension?.dimension_key,
        `profile ${row.profile_id} dimension key`,
      )));
      if (memberFieldKeys.some((fieldKey) => !knownDimensions.has(fieldKey))) {
        fail(
          'REVIEW_STATE_DRIFT',
          `fact group ${groupKey} is outside its profile dimension inventory.`,
        );
      }
      const delegatedDimensions = new Set(array(
        profile?.excluded_or_delegated_dimensions ?? [],
        `profile ${row.profile_id} dimension dispositions`,
      ).filter((dimension) => dimension?.disposition === 'DELEGATED').map((dimension) => text(
        dimension?.dimension_key,
        `profile ${row.profile_id} delegated dimension key`,
      )));
      if (memberFieldKeys.some((fieldKey) => delegatedDimensions.has(fieldKey))) {
        fail(
          'REVIEW_STATE_DRIFT',
          `fact group ${groupKey} includes a delegated profile dimension.`,
        );
      }
      const rule = rules.get(row.rule_id);
      if (!rule) fail('REVIEW_TREE_DRIFT', `fact group ${groupKey} has no rule.`);
      const memberFactIds = memberFieldKeys.flatMap((fieldKey) => {
        const localFactIds = array(rule.fact_ids, `rule ${rule.rule_id} fact IDs`).filter((factId) => {
          const fact = facts.get(factId);
          if (!fact || fact.owner_rule_id !== rule.rule_id) {
            fail('REVIEW_TREE_DRIFT', `fact ${factId} does not belong to rule ${rule.rule_id}.`);
          }
          return fact.field_key === fieldKey;
        });
        const visiting = new Set([rule.rule_id]);
        function descendantHasField(candidateRule) {
          for (const childRuleId of array(
            candidateRule.child_rule_ids,
            `rule ${candidateRule.rule_id} child rule IDs`,
          )) {
            text(childRuleId, `rule ${candidateRule.rule_id} child rule ID`);
            if (visiting.has(childRuleId)) {
              fail('REVIEW_TREE_DRIFT', `rule ${childRuleId} creates a child-rule cycle.`);
            }
            const childRule = rules.get(childRuleId);
            if (!childRule) {
              fail('REVIEW_TREE_DRIFT', `rule ${candidateRule.rule_id} has a missing child rule.`);
            }
            visiting.add(childRuleId);
            const found = array(childRule.fact_ids, `rule ${childRuleId} fact IDs`).some((factId) => {
              const fact = facts.get(factId);
              if (!fact || fact.owner_rule_id !== childRuleId) {
                fail('REVIEW_TREE_DRIFT', `fact ${factId} does not belong to rule ${childRuleId}.`);
              }
              return fact.field_key === fieldKey;
            }) || descendantHasField(childRule);
            visiting.delete(childRuleId);
            if (found) return true;
          }
          return false;
        }
        if (localFactIds.length === 0 && descendantHasField(rule)) {
          fail(
            'REVIEW_STATE_DRIFT',
            `fact group ${groupKey} includes a dimension supplied only by a child rule.`,
          );
        }
        return localFactIds;
      });
      if (memberFactIds.length === 0) continue;
      const assigned = assignedFactIdsByRule.get(row.rule_id);
      if (memberFactIds.some((factId) => assigned.has(factId))) {
        fail('REVIEW_STATE_DRIFT', `fact group ${groupKey} overlaps another group.`);
      }
      memberFactIds.forEach((factId) => assigned.add(factId));
      factGroupsByRule.get(row.rule_id).push({
        group_key: groupKey,
        label,
        member_field_keys: [...memberFieldKeys],
        member_fact_ids: memberFactIds,
      });
    }
  }

  const ungroupedFactIdsByRule = new Map(publicRows.map((row) => {
    const rule = rules.get(row.rule_id);
    const assigned = assignedFactIdsByRule.get(row.rule_id);
    const factIds = array(rule?.fact_ids, `rule ${row.rule_id} fact IDs`);
    const ungroupedFactIds = factIds.filter((factId) => !assigned.has(factId));
    const emittedFactIds = [
      ...factGroupsByRule.get(row.rule_id).flatMap((group) => group.member_fact_ids),
      ...ungroupedFactIds,
    ];
    const emitted = new Set(emittedFactIds);
    if (emittedFactIds.length !== factIds.length
        || emitted.size !== emittedFactIds.length
        || factIds.some((factId) => !emitted.has(factId))) {
      fail('REVIEW_TREE_DRIFT', `fact groups do not partition rule ${row.rule_id} facts.`);
    }
    return [row.rule_id, ungroupedFactIds];
  }));
  return { factGroupsByRule, ungroupedFactIdsByRule };
}

function buildTerminationRightsReviewRowsV2(input) {
  exactKeys(
    input,
    ['analysis', 'projection', 'agreement_indexes', 'review_state'],
    'rich review input',
  );
  const analysis = object(input.analysis, 'analysis');
  const reviewState = object(input.review_state, 'review state');
  exactKeys(reviewState, ['open_review_keys', 'fact_groups'], 'review state');
  const base = buildTerminationRightsReviewRows({
    analysis,
    projection: object(input.projection, 'projection'),
  });
  const profiles = indexUnique(
    array(analysis.profile_snapshots, 'analysis profile snapshots'),
    'profile_id', 'profile snapshot',
  );
  const rules = indexUnique(array(analysis.rules, 'analysis rules'), 'rule_id', 'analysis rule');
  const facts = indexUnique(array(analysis.facts, 'analysis facts'), 'fact_id', 'analysis fact');
  const expressions = indexUnique(
    array(analysis.expressions, 'analysis expressions'),
    'expression_id', 'analysis expression',
  );
  const dependencies = indexUnique(
    array(analysis.dependencies, 'analysis dependencies'),
    'dependency_id', 'analysis dependency',
  );
  const ownershipLinks = indexUnique(
    array(analysis.ownership_links ?? [], 'analysis ownership links'),
    'link_id', 'analysis ownership link',
  );
  const sourceIndex = buildRichSourceIndex(analysis, input.agreement_indexes);
  const childRuleIds = new Set([...rules.values()].flatMap(
    (rule) => array(rule.child_rule_ids, `rule ${rule.rule_id} child rules`),
  ));
  const topLevelRows = base.rows.filter((row) => !childRuleIds.has(row.rule_id));
  const dimensionReviewsByRule = buildOpenDimensionReviews(
    reviewState, base.rows, profiles, facts, sourceIndex, rules, ownershipLinks,
  );
  const { factGroupsByRule, ungroupedFactIdsByRule } = buildFactGroupLayouts(
    reviewState, base.rows, profiles, rules, facts,
  );
  const buildRule = richRuleBuilder({
    analysis,
    sourceIndex,
    profiles,
    rules,
    facts,
    expressions,
    dependencies,
    ownershipLinks,
    dimensionReviewsByRule,
    factGroupsByRule,
    ungroupedFactIdsByRule,
  });
  const rows = topLevelRows.map((row) => {
    const richRule = buildRule(row.rule_id);
    return {
      ...structuredClone(row),
      full_provision: richRule.full_provision,
      linked_provisions: richRule.linked_provisions,
      dependency_references: richRule.dependency_references,
      expression_tree: richRule.expression_tree,
      child_rules: richRule.child_rules,
      fact_ids: richRule.fact_ids,
      fact_groups: richRule.fact_groups,
      ungrouped_fact_ids: richRule.ungrouped_fact_ids,
      dimension_reviews: richRule.dimension_reviews,
      decision_review_required: richRule.decision_review_required,
    };
  });
  return deepFreeze({
    schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
    agreement_analysis_id: base.agreement_analysis_id,
    agreement_projection_id: base.agreement_projection_id,
    rows,
    general_review_items: structuredClone(base.general_review_items),
  });
}

function buildTerminationRightsReviewRows(input) {
  exactKeys(input, ['analysis', 'projection'], 'input');
  const analysis = object(input.analysis, 'analysis');
  const projection = object(input.projection, 'projection');
  text(analysis.agreement_analysis_id, 'analysis.agreement_analysis_id');
  text(projection.agreement_analysis_id, 'projection.agreement_analysis_id');
  text(projection.agreement_projection_id, 'projection.agreement_projection_id');
  if (analysis.schema_version !== 'AGREEMENT_ANALYSIS/V2'
      || projection.schema_version !== 'AGREEMENT_PROJECTION/V2'
      || projection.agreement_analysis_id !== analysis.agreement_analysis_id) {
    fail('INVALID_REVIEW_INPUT', 'Analysis and projection identities do not match.');
  }

  const occurrenceOrder = array(
    analysis.governed_input_occurrence_ids, 'governed input occurrences',
  );
  const occurrenceOrdinals = new Map();
  occurrenceOrder.forEach((occurrenceId, ordinal) => {
    text(occurrenceId, 'governed occurrence ID');
    if (occurrenceOrdinals.has(occurrenceId)) {
      fail('REVIEW_JOIN_DRIFT', `governed occurrence ${occurrenceId} is duplicated.`);
    }
    occurrenceOrdinals.set(occurrenceId, ordinal);
  });

  const profiles = indexUnique(
    array(analysis.profile_snapshots, 'analysis profile snapshots'),
    'profile_id', 'profile snapshot',
  );
  const rules = indexUnique(array(analysis.rules, 'analysis rules'), 'rule_id', 'analysis rule');
  const dispositions = indexUnique(
    array(analysis.dispositions, 'analysis dispositions'),
    'input_occurrence_id', 'analysis disposition',
  );
  const effects = effectIndex(analysis.candidate_sets);
  const projectionRows = normalRowsByRule(projection);
  const reviewIssues = reviewIssuesByRule(projection);

  const generalReviewItems = [];
  for (const reviewRow of projection.review_rows) {
    const disposition = dispositions.get(reviewRow.input_occurrence_id);
    if (!disposition || disposition.disposition_id !== reviewRow.disposition_id) {
      fail('REVIEW_JOIN_DRIFT', 'a review row is joined to the wrong disposition.');
    }
    requireCanonicalIssues(reviewRow, disposition);
    if (disposition.prior_family_key !== 'TERMINATION') continue;
    const governedOrdinal = occurrenceOrdinals.get(reviewRow.input_occurrence_id);
    if (governedOrdinal === undefined) {
      fail('REVIEW_JOIN_DRIFT', 'a review row has no governed occurrence.');
    }
    for (const issue of reviewRow.issues.filter((entry) => entry.rule_id === null)) {
      const effectEntry = effects.get(issue.effect_id);
      if (!effectEntry
          || effectEntry.effect.input_occurrence_id !== reviewRow.input_occurrence_id) {
        fail('REVIEW_JOIN_DRIFT', 'an unassigned review issue is joined to the wrong effect.');
      }
      const sourceSpanIds = array(issue.source_span_ids, 'review issue source spans')
        .map((spanId) => text(spanId, 'review issue source span ID'));
      if (sourceSpanIds.length === 0) {
        fail('REVIEW_JOIN_DRIFT', 'an unassigned review issue has no source span.');
      }
      generalReviewItems.push({
        display_section_id: 'termination-rights',
        governed_ordinal: governedOrdinal,
        input_occurrence_id: reviewRow.input_occurrence_id,
        disposition_id: disposition.disposition_id,
        effect_id: issue.effect_id,
        rule_id: null,
        output_disposition: 'REVIEW_ONLY',
        review_required: true,
        extraction_state: issue.extraction_state,
        source_quality: issue.source_quality,
        issue_code: text(issue.issue_code, 'review issue code'),
        source_span_ids: sourceSpanIds,
        _effect_ordinal: effectEntry.ordinal,
      });
    }
  }

  const rows = [];
  let ruleOrdinal = 0;
  for (const rule of rules.values()) {
    object(rule.validation, `rule ${rule.rule_id} validation`);
    const profile = profiles.get(rule.profile_id);
    if (!profile || !terminationRightProfile(profile)) {
      ruleOrdinal += 1;
      continue;
    }
    const occurrenceOrdinal = occurrenceOrdinals.get(rule.input_occurrence_id);
    const disposition = dispositions.get(rule.input_occurrence_id);
    const effectEntry = effects.get(rule.effect_id);
    if (occurrenceOrdinal === undefined || !disposition || !effectEntry
        || effectEntry.effect.input_occurrence_id !== rule.input_occurrence_id) {
      fail('REVIEW_JOIN_DRIFT', `rule ${rule.rule_id} has incomplete occurrence evidence.`);
    }
    const output = rule.validation.output_disposition;
    const normal = ['NORMAL', 'APPROVED_LIMITED'].includes(output);
    const review = output === 'REVIEW_ONLY';
    if (!normal && !review) {
      ruleOrdinal += 1;
      continue;
    }
    const projectionRow = projectionRows.get(rule.rule_id) ?? null;
    const issueEntry = reviewIssues.get(`${rule.effect_id}\0${rule.rule_id}`) ?? null;
    if ((normal && (!projectionRow || issueEntry))
        || (review && (projectionRow || !issueEntry))) {
      fail('REVIEW_JOIN_DRIFT', `rule ${rule.rule_id} has inconsistent Review routing.`);
    }
    let issueCodes = [];
    let sourceSpanIds = [...effectEntry.effect.source_span_ids];
    if (review) {
      if (issueEntry.disposition_id !== disposition.disposition_id
          || issueEntry.input_occurrence_id !== rule.input_occurrence_id) {
        fail('REVIEW_JOIN_DRIFT', `rule ${rule.rule_id} is joined to the wrong disposition.`);
      }
      const issueCodeSet = new Set();
      const spanSet = new Set();
      for (const issue of issueEntry.issues) {
        if (issue.effect_id !== rule.effect_id || issue.rule_id !== rule.rule_id
            || issue.extraction_state !== rule.validation.extraction_state
            || issue.source_quality !== rule.validation.source_quality) {
          fail('REVIEW_JOIN_DRIFT', `rule ${rule.rule_id} issue evidence is inconsistent.`);
        }
        text(issue.issue_code, 'review issue code');
        if (issueCodeSet.has(issue.issue_code)) {
          fail('REVIEW_JOIN_DRIFT', `rule ${rule.rule_id} repeats an issue code.`);
        }
        issueCodeSet.add(issue.issue_code);
        for (const spanId of array(issue.source_span_ids, 'review issue source spans')) {
          spanSet.add(text(spanId, 'review issue source span ID'));
        }
      }
      issueCodes = array(rule.validation.issue_codes, 'rule issue codes');
      if (issueCodes.length !== issueCodeSet.size
          || issueCodes.some((issueCode) => !issueCodeSet.has(issueCode))) {
        fail('REVIEW_JOIN_DRIFT', `rule ${rule.rule_id} issue codes are incomplete.`);
      }
      sourceSpanIds = [...spanSet];
      if (sourceSpanIds.length === 0) {
        fail('REVIEW_JOIN_DRIFT', `rule ${rule.rule_id} has no review source span.`);
      }
    }
    if (normal && (projectionRow.disposition_id !== disposition.disposition_id
        || projectionRow.output_disposition !== output)) {
      fail('REVIEW_JOIN_DRIFT', `rule ${rule.rule_id} projection row is inconsistent.`);
    }
    const subtypeKey = profile.subtype_path.at(-1);
    text(subtypeKey, `profile ${profile.profile_id} subtype`);
    if (typeof profile.profile_key !== 'string' || profile.profile_key.length === 0) {
      fail('REVIEW_JOIN_DRIFT', `profile ${profile.profile_id} has no stable profile key.`);
    }
    rows.push({
      display_section_id: 'termination-rights',
      governed_ordinal: occurrenceOrdinal,
      input_occurrence_id: rule.input_occurrence_id,
      disposition_id: disposition.disposition_id,
      effect_id: rule.effect_id,
      rule_id: rule.rule_id,
      profile_id: profile.profile_id,
      profile_key: profile.profile_key,
      subtype_key: subtypeKey,
      projection_row_id: projectionRow?.row_id ?? null,
      fact_ids: [...array(rule.fact_ids, 'rule fact IDs')],
      source_span_ids: sourceSpanIds,
      extraction_state: rule.validation.extraction_state,
      source_quality: rule.validation.source_quality,
      output_disposition: output,
      review_required: review,
      issue_codes: [...issueCodes],
      _effect_ordinal: effectEntry.ordinal,
      _rule_ordinal: ruleOrdinal,
    });
    ruleOrdinal += 1;
  }

  rows.sort((left, right) => left.governed_ordinal - right.governed_ordinal
    || left._effect_ordinal - right._effect_ordinal
    || left._rule_ordinal - right._rule_ordinal);
  generalReviewItems.sort((left, right) => left.governed_ordinal - right.governed_ordinal
    || left._effect_ordinal - right._effect_ordinal);
  const publicRows = rows.map(({ _effect_ordinal, _rule_ordinal, ...row }) => row);
  const publicGeneralReviewItems = generalReviewItems.map(({ _effect_ordinal, ...item }) => item);
  return deepFreeze({
    schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V1',
    agreement_analysis_id: analysis.agreement_analysis_id,
    agreement_projection_id: projection.agreement_projection_id,
    rows: publicRows,
    general_review_items: publicGeneralReviewItems,
  });
}

module.exports = {
  TerminationRightsReviewRowsError,
  buildTerminationRightsReviewRows,
  buildTerminationRightsReviewRowsV2,
};
