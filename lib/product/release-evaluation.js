'use strict';

const WEIGHTS = Object.freeze({ CRITICAL: 3, MATERIAL: 1 });

class ProductReleaseEvaluationError extends Error {
  constructor(code, detail) { super(`${code}: ${detail}`); this.name = 'ProductReleaseEvaluationError'; this.code = code; }
}

function fail(code, detail) { throw new ProductReleaseEvaluationError(code, detail); }
function ratio(numerator, denominator) { return denominator === 0 ? 1 : numerator / denominator; }
function semanticFactValue(fact) {
  return JSON.stringify({
    statement: fact.statement || null,
    roles: Object.fromEntries(Object.entries(fact.roles || {}).sort(([left], [right]) => left.localeCompare(right))),
    canonical_value: fact.canonical_value ?? null,
  });
}

function evaluateSupervisedRelease({ inventory, reconciliation, analysis, reviewState, legalSchema, citationAssessments, findingResolutions = [], elapsedMinutes, developerAssisted, processingStartedAt, processingCompletedAt }) {
  if (!Array.isArray(inventory) || !Array.isArray(reconciliation) || !analysis || !reviewState || !legalSchema
    || !Array.isArray(citationAssessments) || !Array.isArray(findingResolutions)) {
    fail('EVALUATION_INPUT', 'inventory, reconciliation, analysis, review, legal schema, citations and finding resolutions are required');
  }
  const inventoryById = new Map();
  for (const item of inventory) {
    if (!item?.inventory_item_id || !WEIGHTS[item.severity] || inventoryById.has(item.inventory_item_id)) fail('INVENTORY_ITEM', item?.inventory_item_id || 'missing');
    inventoryById.set(item.inventory_item_id, item);
  }
  const reconciliationById = new Map();
  for (const item of reconciliation) {
    if (!inventoryById.has(item.inventory_item_id) || reconciliationById.has(item.inventory_item_id)
      || !['PUBLISHED_FACT', 'REVIEWED_OMISSION', 'UNRESOLVED'].includes(item.disposition)
      || item.reviewed_by_role !== 'LAWYER'
      || (item.disposition === 'REVIEWED_OMISSION' && (typeof item.omission_reason !== 'string' || item.omission_reason.trim() === ''))) {
      fail('RECONCILIATION_ITEM', item?.inventory_item_id || 'missing');
    }
    reconciliationById.set(item.inventory_item_id, item);
  }
  const publishedFacts = reviewState.summary?.families?.flatMap((family) => family.facts || []) || [];
  const factIds = new Set();
  for (const fact of publishedFacts) {
    if (!fact.review_item_id || factIds.has(fact.review_item_id)) fail('PUBLISHED_FACT', fact.review_item_id || 'missing');
    factIds.add(fact.review_item_id);
  }
  for (const item of reconciliation) {
    if (item.disposition === 'PUBLISHED_FACT' && !factIds.has(item.review_item_id)) fail('RECONCILIATION_FACT', item.inventory_item_id);
  }
  const reviewItems = new Map((reviewState.items || []).map((item) => [item.item_id, item]));
  const coverageById = new Map((analysis.coverage_assertions || [])
    .filter((item) => item.coverage_assertion_id).map((item) => [item.coverage_assertion_id, item]));
  const issueById = new Map((analysis.issues || [])
    .filter((item) => item.issue_id).map((item) => [item.issue_id, item]));
  const publishedFactsById = new Map(publishedFacts.map((item) => [item.review_item_id, item]));
  const resolvedFindingKeys = new Set();
  for (const resolution of findingResolutions) {
    const findingItem = reviewItems.get(resolution?.finding_item_id);
    const validDisposition = ['PUBLISHED_FACT', 'REVIEWED_OMISSION'].includes(resolution?.disposition);
    if (!findingItem || !['COVERAGE', 'ISSUE'].includes(findingItem.kind)
      || findingItem.decision !== 'ACCEPTED' || findingItem.decided_by_role !== 'LAWYER'
      || resolution.reviewed_by_role !== 'LAWYER' || !validDisposition) {
      fail('FINDING_RESOLUTION', resolution?.finding_item_id || 'missing');
    }
    let finding;
    let findingKey;
    if (findingItem.kind === 'COVERAGE') {
      finding = coverageById.get(findingItem.source_id);
      findingKey = `coverage:${findingItem.source_id}`;
      if (!finding || finding.state !== 'UNRESOLVED') fail('FINDING_RESOLUTION', findingItem.item_id);
    } else {
      finding = issueById.get(findingItem.source_id);
      findingKey = `issue:${findingItem.source_id}`;
      if (!finding || !/CONTRADICT/i.test(finding.code || '') || ['CLOSED', 'RESOLVED'].includes(finding.state)) {
        fail('FINDING_RESOLUTION', findingItem.item_id);
      }
    }
    if (resolvedFindingKeys.has(findingKey)) fail('FINDING_RESOLUTION', findingItem.item_id);
    if (resolution.disposition === 'PUBLISHED_FACT') {
      const fact = publishedFactsById.get(resolution.published_fact_review_item_id);
      if (!fact || resolution.omission_reason !== undefined
        || (finding.structure_node_id && fact.structure_node_id !== finding.structure_node_id)
        || (finding.family_key && fact.family_key !== finding.family_key)) {
        fail('FINDING_RESOLUTION', findingItem.item_id);
      }
      if (findingItem.kind === 'COVERAGE' && finding.subject_kind === 'FACT_TYPE') {
        const factType = finding.reason?.startsWith('FACT_TYPE:')
          ? finding.reason.slice('FACT_TYPE:'.length) : String(finding.subject_id || '').split(':').at(-1);
        if (!factType || fact.fact_type !== factType) fail('FINDING_RESOLUTION', findingItem.item_id);
      }
    } else if (typeof resolution.omission_reason !== 'string' || resolution.omission_reason.trim() === ''
      || resolution.published_fact_review_item_id !== undefined) {
      fail('FINDING_RESOLUTION', findingItem.item_id);
    }
    resolvedFindingKeys.add(findingKey);
  }
  const citationByFact = new Map();
  for (const item of citationAssessments) {
    if (!factIds.has(item?.review_item_id) || citationByFact.has(item.review_item_id) || item.reviewed_by_role !== 'LAWYER') {
      fail('CITATION_ASSESSMENT', item?.review_item_id || 'missing');
    }
    citationByFact.set(item.review_item_id, item);
  }
  const matchedFactWeights = new Map();
  let totalWeight = 0;
  let foundWeight = 0;
  let unresolvedWeight = 0;
  for (const item of inventory) {
    const weight = WEIGHTS[item.severity];
    totalWeight += weight;
    const match = reconciliationById.get(item.inventory_item_id);
    if (match?.disposition === 'PUBLISHED_FACT' && factIds.has(match.review_item_id)) {
      foundWeight += weight;
      matchedFactWeights.set(match.review_item_id, Math.max(weight, matchedFactWeights.get(match.review_item_id) || 0));
    }
    if (!match || match.disposition !== 'PUBLISHED_FACT') unresolvedWeight += weight;
  }
  const duplicateKeys = new Map();
  for (const fact of publishedFacts) {
    const key = `${fact.family_key}\u001f${fact.subtype_key}\u001f${fact.fact_type}\u001f${[...(fact.source_span_ids || [])].sort().join(',')}`;
    duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
  }
  const duplicateCount = [...duplicateKeys.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const contradictions = new Set((analysis.issues || []).filter((item) => /CONTRADICT/i.test(item.code || '')
    && !['CLOSED', 'RESOLVED'].includes(item.state) && !resolvedFindingKeys.has(`issue:${item.issue_id}`))
    .map((item) => `issue:${item.issue_id || item.code}`));
  const propositionSlots = new Map();
  for (const fact of publishedFacts.filter((item) => item.proposition_group_id)) {
    const slot = [fact.proposition_group_id, fact.family_key, fact.subtype_key, fact.fact_type].join('\u001f');
    if (!propositionSlots.has(slot)) propositionSlots.set(slot, new Map());
    propositionSlots.get(slot).set(fact.review_item_id, semanticFactValue(fact));
  }
  for (const [slot, facts] of propositionSlots) {
    if (facts.size > 1 && new Set(facts.values()).size > 1) contradictions.add(`published-group:${slot}`);
  }
  const contradictionCount = contradictions.size;
  const unresolvedIdentities = new Set();
  for (const item of (analysis.coverage_assertions || []).filter((candidate) => candidate.state === 'NOT_RUN'
    || (candidate.state === 'UNRESOLVED' && !resolvedFindingKeys.has(`coverage:${candidate.coverage_assertion_id}`)))) {
    unresolvedIdentities.add(`coverage:${item.coverage_assertion_id || `${item.subject_kind}:${item.subject_id}`}`);
  }
  for (const item of reviewState.items.filter((candidate) => candidate.decision === 'UNRESOLVED')) {
    unresolvedIdentities.add(item.kind === 'COVERAGE' ? `coverage:${item.source_id}` : `review:${item.item_id}`);
  }
  const unresolvedCount = unresolvedIdentities.size;
  const citationsSufficient = publishedFacts.length > 0 && citationAssessments.length === publishedFacts.length && publishedFacts.every((fact) => {
    const assessment = citationByFact.get(fact.review_item_id);
    return fact.source_span_ids?.length > 0 && assessment?.exact === true && assessment?.legally_sufficient === true;
  });
  const publishedRolesComplete = publishedFacts.every((fact) => {
    const family = legalSchema.families?.find((item) => item.family_key === fact.family_key && item.state === 'DEFINED');
    const subtype = family?.subtypes?.find((item) => item.subtype_key === fact.subtype_key);
    return Boolean(family && family.required_fact_types.includes(fact.fact_type) && subtype
      && subtype.required_roles.every((role) => fact.roles?.[role] !== undefined && fact.roles[role] !== null && fact.roles[role] !== ''));
  });
  const coverageStates = new Set(['FOUND', 'NOT_FOUND', 'UNRESOLVED', 'NOT_RUN']);
  const expectedSectionIds = (analysis.sections || []).map((item) => item.structure_node_id);
  const sectionAssertions = (analysis.coverage_assertions || []).filter((item) => item.subject_kind === 'SECTION');
  const everySectionDisposed = expectedSectionIds.length > 0
    && new Set(expectedSectionIds).size === expectedSectionIds.length
    && sectionAssertions.length === expectedSectionIds.length
    && expectedSectionIds.every((id) => sectionAssertions.filter((item) => item.subject_id === id
      && item.structure_node_id === id && coverageStates.has(item.state)).length === 1);
  const expectedRoleIds = [];
  for (const proposal of analysis.proposals || []) {
    const family = legalSchema.families?.find((item) => item.family_key === proposal.family_key && item.state === 'DEFINED');
    const subtype = family?.subtypes?.find((item) => item.subtype_key === proposal.subtype_key);
    if (!subtype) {
      expectedRoleIds.push(`invalid:${proposal.proposal_id || proposal.fact_occurrence_id}`);
      continue;
    }
    for (const role of subtype.required_roles) expectedRoleIds.push(`${proposal.fact_occurrence_id}:${role}`);
  }
  const roleAssertions = (analysis.coverage_assertions || []).filter((item) => item.subject_kind === 'ROLE');
  const everyRequiredRoleDisposed = new Set(expectedRoleIds).size === expectedRoleIds.length
    && roleAssertions.length === expectedRoleIds.length
    && expectedRoleIds.every((id) => roleAssertions.filter((item) => item.subject_id === id
      && item.required_role === id.slice(id.lastIndexOf(':') + 1) && coverageStates.has(item.state)).length === 1);
  const exceptionsReviewed = reviewState.items.filter((item) => item.kind === 'EXCEPTION_LINK').every((item) => item.decision !== 'PENDING');
  const inventoryReconciled = inventory.length > 0 && publishedFacts.length > 0
    && inventory.every((item) => ['PUBLISHED_FACT', 'REVIEWED_OMISSION'].includes(reconciliationById.get(item.inventory_item_id)?.disposition));
  const allFactsAccepted = publishedFacts.length > 0 && publishedFacts.every((fact) => reviewState.items.some((item) => item.item_id === fact.review_item_id
    && ['ACCEPTED', 'EDITED'].includes(item.decision) && item.decided_by_role === 'LAWYER'));
  const matchedPublishedWeight = [...matchedFactWeights.values()].reduce((sum, weight) => sum + weight, 0);
  const unmatchedPublishedCount = publishedFacts.filter((fact) => !matchedFactWeights.has(fact.review_item_id)).length;
  const measuredReviewSeconds = reviewState.metrics?.review_time_seconds;
  const processingStart = Date.parse(processingStartedAt || '');
  const processingEnd = Date.parse(processingCompletedAt || '');
  const processingMinutes = Number.isFinite(processingStart) && Number.isFinite(processingEnd) && processingEnd >= processingStart
    ? (processingEnd - processingStart) / 60000 : NaN;
  const measuredReviewMinutes = Number.isFinite(measuredReviewSeconds) && measuredReviewSeconds >= 0 ? measuredReviewSeconds / 60 : NaN;
  const effectiveElapsedMinutes = Number.isFinite(elapsedMinutes) && Number.isFinite(processingMinutes) && Number.isFinite(measuredReviewMinutes)
    ? Math.max(elapsedMinutes, processingMinutes + measuredReviewMinutes) : NaN;
  const bars = {
    inventory_reconciled: inventoryReconciled,
    citations_exact_and_legally_sufficient: citationsSufficient,
    section_role_exception_and_agreement_coverage_complete: publishedRolesComplete && everySectionDisposed && everyRequiredRoleDisposed && exceptionsReviewed
      && reviewState.agreement_coverage?.decision === 'ACCEPTED' && reviewState.agreement_coverage?.confirmed_by_role === 'LAWYER',
    no_group_contradiction: contradictionCount === 0,
    no_unresolved_presented_as_completion: unresolvedCount === 0,
    all_final_facts_lawyer_accepted: allFactsAccepted,
    timing_measured_without_developer: Number.isFinite(effectiveElapsedMinutes)
      && elapsedMinutes >= 0
      && Number.isFinite(measuredReviewSeconds) && measuredReviewSeconds >= 0
      && developerAssisted === false,
  };
  return Object.freeze({
    schema_version: 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V2',
    diagnostics: {
      severity_weighted_recall: ratio(foundWeight, totalWeight),
      severity_weighted_precision: ratio(matchedPublishedWeight, matchedPublishedWeight + unmatchedPublishedCount),
      citation_sufficiency_rate: ratio(publishedFacts.filter((fact) => {
        const item = citationByFact.get(fact.review_item_id); return item?.exact && item?.legally_sufficient;
      }).length, publishedFacts.length),
      citation_narrowness_rate: ratio(publishedFacts.filter((fact) => citationByFact.get(fact.review_item_id)?.narrow).length, publishedFacts.length),
      duplicate_count: duplicateCount, duplicate_rate: ratio(duplicateCount, publishedFacts.length),
      contradiction_count: contradictionCount, contradiction_rate: ratio(contradictionCount, publishedFacts.length),
      unresolved_count: unresolvedCount, unresolved_weight: unresolvedWeight,
      review_time_minutes: elapsedMinutes, measured_review_time_seconds: measuredReviewSeconds,
      processing_minutes: processingMinutes, effective_elapsed_minutes: effectiveElapsedMinutes,
      developer_assisted: developerAssisted,
    },
    bars,
    passed: Object.values(bars).every(Boolean),
  });
}

module.exports = { ProductReleaseEvaluationError, WEIGHTS, evaluateSupervisedRelease };
