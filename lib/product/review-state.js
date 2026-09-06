'use strict';

const { canonicalJson, contentId, sha256Hex } = require('../canonical-v2/canonical-bytes');
const { parseFeeAmount, parseTailPeriodMonths } = require('../canonical-v2/native-producer/termination-fee-parse');
const { parseNoShopPeriod } = require('../canonical-v2/native-producer/no-shop-period-parse');
const { parseTerminationDeadline } = require('../canonical-v2/native-producer/termination-deadline-parse');
const { evaluateSupervisedRelease } = require('./release-evaluation');
const { RELATIONSHIP_TYPES } = require('./legal-schema');

const REVIEW_STATE_VERSION = 'PRODUCT_REVIEW_STATE/V1';
const REVIEW_ITEM_VERSION = 'PRODUCT_REVIEW_ITEM/V1';
const REVIEW_SUMMARY_VERSION = 'PRODUCT_REVIEW_SUMMARY/V1';
const REVIEW_TIMING_VERSION = 'PRODUCT_REVIEW_TIMING/V1';
const USER_RELATIONSHIP_VERSION = 'PRODUCT_USER_RELATIONSHIP/V1';
const DECISIONS = new Set(['ACCEPTED', 'EDITED', 'REJECTED', 'UNRESOLVED']);
const RELATIONSHIP_KINDS = new Set(['EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP']);
const MODEL_RELATIONSHIP_KINDS = new Set(['EXCEPTION_LINK', 'RELATIONSHIP']);

class ProductReviewError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'ProductReviewError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new ProductReviewError(code, detail);
}

function nowIso(clock) {
  return (clock ? clock() : new Date()).toISOString();
}

function makeItem(kind, sourceId, values) {
  const identity = { schema_version: REVIEW_ITEM_VERSION, kind, source_id: sourceId };
  return {
    ...identity,
    item_id: sha256Hex(`${kind}\u001f${sourceId}`),
    decision: 'PENDING',
    reviewed_at: null,
    ...values,
  };
}

function sourceBinding(analysis, structureNodeId, preferredSpanId = null) {
  const spans = analysis.spans || [];
  const closures = analysis.source_closures || [];
  if (!structureNodeId) {
    return {
      source_closure_id: null,
      source_span_ids: spans.filter((span) => span.kind === 'FULL_SECTION').map((span) => span.span_id),
    };
  }
  const closure = closures.find((item) => item.structure_node_id === structureNodeId) || null;
  const closureId = closure?.source_closure_id || null;
  const belongsToClosure = (span) => !closureId
    || (span.source_closure_ids || []).includes(closureId)
    || (closure?.spans || []).some((item) => item.span_id === span.span_id);
  const preferred = preferredSpanId
    ? spans.find((span) => span.span_id === preferredSpanId && belongsToClosure(span))
    : null;
  const fallback = spans.find((span) => span.structure_node_id === structureNodeId
      && span.kind === 'FULL_SECTION' && belongsToClosure(span))
    || spans.find((span) => span.structure_node_id === structureNodeId && belongsToClosure(span))
    || (closure?.spans || []).find((span) => span.kind === 'FULL_SECTION')
    || (closure?.spans || [])[0]
    || null;
  const span = preferred || fallback;
  return { source_closure_id: closureId, source_span_ids: span ? [span.span_id] : [] };
}

function closureSpanIds(analysis, closureId) {
  const closure = (analysis.source_closures || [])
    .find((item) => item.source_closure_id === closureId);
  if (!closure) return null;
  return new Set([
    ...(closure.spans || []).map((span) => span.span_id),
    ...(analysis.spans || []).filter((span) => (span.source_closure_ids || [])
      .includes(closureId)).map((span) => span.span_id),
  ]);
}

function exactRelationshipSource(analysis, link, fromProposal) {
  const sourceSpanIds = Array.isArray(link.source_span_ids) ? [...link.source_span_ids] : [];
  if (sourceSpanIds.length === 0) return { source_closure_id: null, source_span_ids: [] };
  if (typeof link.source_closure_id === 'string' && link.source_closure_id.length > 0) {
    const ids = closureSpanIds(analysis, link.source_closure_id);
    return ids && sourceSpanIds.every((spanId) => ids.has(spanId))
      ? { source_closure_id: link.source_closure_id, source_span_ids: sourceSpanIds }
      : { source_closure_id: null, source_span_ids: [] };
  }
  const matching = (analysis.source_closures || []).filter((closure) => {
    const ids = closureSpanIds(analysis, closure.source_closure_id);
    return ids && sourceSpanIds.every((spanId) => ids.has(spanId));
  });
  const preferred = matching.find((closure) => (
    closure.source_closure_id === fromProposal?.source_closure_id
  ));
  const closure = preferred || (matching.length === 1 ? matching[0] : null);
  return { source_closure_id: closure?.source_closure_id || null, source_span_ids: sourceSpanIds };
}

function modelRelationshipItem(analysis, link) {
  const from = (analysis.proposals || [])
    .find((proposal) => proposal.proposal_id === link.from_proposal_id);
  const source = exactRelationshipSource(analysis, link, from);
  return makeItem(link.relationship_type === 'EXCEPTS' ? 'EXCEPTION_LINK' : 'RELATIONSHIP',
    link.fact_link_id, {
      structure_node_id: from?.structure_node_id || null,
      family_key: from?.family_key || null,
      ...source,
      original: link,
      edited_relationship: null,
    });
}

function normaliseReviewRelationships(state, analysis) {
  if (!state || state.status === 'PUBLISHED') return state;
  const rawLinks = analysis?.fact_links || [];
  const rawIds = new Set(rawLinks.map((link) => link.fact_link_id));
  const selectedBySource = new Map();
  for (const item of state.items || []) {
    if (!MODEL_RELATIONSHIP_KINDS.has(item.kind) || !rawIds.has(item.source_id)) continue;
    const raw = rawLinks.find((link) => link.fact_link_id === item.source_id);
    const preferredKind = raw?.relationship_type === 'EXCEPTS' ? 'EXCEPTION_LINK' : 'RELATIONSHIP';
    const selected = selectedBySource.get(item.source_id);
    if (!selected || (item.kind === preferredKind && selected.kind !== preferredKind)) {
      selectedBySource.set(item.source_id, item);
    }
  }
  const items = (state.items || []).filter((item) => (
    !MODEL_RELATIONSHIP_KINDS.has(item.kind) || !rawIds.has(item.source_id)
      || selectedBySource.get(item.source_id) === item
  ));
  const present = new Set(items.filter((item) => MODEL_RELATIONSHIP_KINDS.has(item.kind))
    .map((item) => item.source_id));
  for (const link of rawLinks) {
    if (!present.has(link.fact_link_id)) items.push(modelRelationshipItem(analysis, link));
  }
  const sorted = items.sort((left, right) => left.item_id.localeCompare(right.item_id));
  if (sorted.length === (state.items || []).length
    && sorted.every((item, index) => item === state.items[index])) return state;
  return { ...state, items: sorted };
}

function initialiseReviewState(analysis, { clock } = {}) {
  if (!analysis || analysis.kind !== 'draftAnalysis' || !analysis.draft_analysis_id) {
    fail('ANALYSIS_NOT_READY', 'draftAnalysis is required');
  }
  const items = [];
  for (const proposal of analysis.proposals || []) {
    items.push(makeItem('PROPOSAL', proposal.proposal_id, {
      structure_node_id: proposal.structure_node_id || null,
      family_key: proposal.family_key,
      source_closure_id: proposal.source_closure_id,
      source_span_ids: [...proposal.source_span_ids],
      original: proposal,
      edited_statement: null,
      edited_roles: null,
      edited_value: null,
    }));
  }
  for (const link of analysis.fact_links || []) items.push(modelRelationshipItem(analysis, link));
  for (const issue of analysis.issues || []) {
    items.push(makeItem('ISSUE', issue.issue_id, {
      structure_node_id: issue.structure_node_id,
      family_key: issue.family_key,
      source_closure_id: issue.source_closure_id || null,
      source_span_ids: [...(issue.source_span_ids || [])],
      original: issue,
    }));
  }
  for (const assertion of (analysis.coverage_assertions || []).filter((item) => (
    (item.subject_kind === 'RESIDUAL_PARAGRAPH'
      && (item.state === 'UNRESOLVED' || item.reason === 'IMMATERIAL'))
      || item.state === 'UNRESOLVED'
      || (item.state === 'NOT_FOUND' && ['FAMILY', 'FACT_TYPE'].includes(item.subject_kind))
  ))) {
    const source = sourceBinding(analysis, assertion.structure_node_id,
      assertion.subject_kind === 'RESIDUAL_PARAGRAPH' ? assertion.subject_id : null);
    items.push(makeItem('COVERAGE', assertion.coverage_assertion_id, {
      structure_node_id: assertion.structure_node_id,
      family_key: assertion.family_key,
      ...source,
      original: assertion,
    }));
  }
  for (const routing of (analysis.sections || []).filter((item) => item.disposition === 'IMMATERIAL')) {
    const source = sourceBinding(analysis, routing.structure_node_id);
    items.push(makeItem('IMMATERIAL_ROUTING', routing.section_routing_id, {
      structure_node_id: routing.structure_node_id,
      family_key: null,
      ...source,
      original: routing,
    }));
  }
  const createdAt = nowIso(clock);
  return {
    schema_version: REVIEW_STATE_VERSION,
    draft_analysis_id: analysis.draft_analysis_id,
    analysis_run_id: analysis.analysis_run_id,
    status: 'DRAFT',
    started_at: createdAt,
    review_timing: {
      schema_version: REVIEW_TIMING_VERSION,
      accumulated_draft_seconds: 0,
      active_draft_started_at: createdAt,
    },
    updated_at: createdAt,
    published_at: null,
    agreement_coverage: { decision: 'PENDING', reviewed_at: null },
    items: items.sort((left, right) => left.item_id.localeCompare(right.item_id)),
    summary: null,
    metrics: null,
    release_evaluation_input: null,
    release_evaluation: null,
  };
}

function requireDraft(state) {
  if (!state || state.schema_version !== REVIEW_STATE_VERSION) fail('REVIEW_STATE', REVIEW_STATE_VERSION);
  if (state.status !== 'DRAFT') fail('REVIEW_NOT_EDITABLE', state.status);
}

function sourceSpanSet(analysis) {
  return new Set((analysis.spans || []).map((span) => span.span_id));
}

function factContract(legalSchema, familyKey, subtypeKey, factType, roles) {
  const family = legalSchema?.families?.find((item) => item.family_key === familyKey && item.state === 'DEFINED');
  if (!family || !family.required_fact_types.includes(factType)) fail('REVIEW_FACT_CONTRACT', `${familyKey}.${factType}`);
  const subtype = family.subtypes.find((item) => item.subtype_key === subtypeKey);
  if (!subtype) fail('REVIEW_FACT_CONTRACT', `${familyKey}.${subtypeKey}`);
  const missing = subtype.required_roles.filter((role) => roles?.[role] === undefined || roles[role] === null || roles[role] === '');
  if (missing.length > 0) fail('REVIEW_FACT_ROLES', missing.join(','));
  return { family, subtype };
}

function proposalCitationSelection(current, command, analysis) {
  const supplied = command.source_span_ids !== undefined;
  if (current.kind === 'PROPOSAL' && current.original.validation_status !== 'VALID' && !supplied) {
    fail('REVIEW_INVALID_PROPOSAL_SOURCE', current.item_id);
  }
  const selected = supplied ? command.source_span_ids : current.source_span_ids;
  if (!Array.isArray(selected) || selected.length === 0
    || selected.some((id) => typeof id !== 'string' || id.length === 0)
    || new Set(selected).size !== selected.length) {
    fail('REVIEW_PROPOSAL_SOURCE', 'one or more unique source spans are required');
  }
  const spansById = new Map((analysis.spans || []).map((span) => [span.span_id, span]));
  if (selected.some((id) => !spansById.has(id))) fail('REVIEW_PROPOSAL_SOURCE', 'unknown span');
  const closure = (analysis.source_closures || [])
    .find((item) => item.source_closure_id === current.source_closure_id);
  const closureSpanIds = new Set([
    ...(closure?.spans || []).map((span) => span.span_id),
    ...(analysis.spans || []).filter((span) => (span.source_closure_ids || [])
      .includes(current.source_closure_id)).map((span) => span.span_id),
  ]);
  if (!closure || selected.some((id) => !closureSpanIds.has(id))) {
    fail('REVIEW_PROPOSAL_SOURCE', 'span outside proposal closure');
  }
  return { selected: [...selected], spansById };
}

function validatePropositionGroupSelection(current, command, analysis) {
  if (!Object.hasOwn(command, 'proposition_group_id')) return;
  if (current.kind !== 'PROPOSAL') fail('REVIEW_PROPOSITION_GROUP', current.kind);
  if (command.proposition_group_id === null) return;
  if (typeof command.proposition_group_id !== 'string' || command.proposition_group_id.trim() === '') {
    fail('REVIEW_PROPOSITION_GROUP', 'a recorded group ID or null is required');
  }
  const group = (analysis.proposition_groups || []).find((candidate) => (
    candidate.proposition_group_id === command.proposition_group_id
  ));
  if (!group || group.family_key !== current.original.family_key
    || group.subtype_key !== current.original.subtype_key) {
    fail('REVIEW_PROPOSITION_GROUP', command.proposition_group_id);
  }
}

function decideItem(state, command, timestamp, legalSchema, analysis) {
  if (!DECISIONS.has(command.decision)) fail('REVIEW_DECISION', String(command.decision));
  const index = state.items.findIndex((item) => item.item_id === command.item_id);
  if (index < 0) fail('REVIEW_ITEM_NOT_FOUND', command.item_id);
  const current = state.items[index];
  if (command.decision === 'EDITED' && current.kind !== 'PROPOSAL' && current.kind !== 'USER_FACT') {
    fail('REVIEW_EDIT_KIND', current.kind);
  }
  if (command.decision === 'EDITED' && (!command.statement || typeof command.statement !== 'string')) {
    fail('REVIEW_EDIT_STATEMENT', current.item_id);
  }
  if (command.decision === 'ACCEPTED' && current.kind === 'PROPOSAL'
    && current.original.validation_status !== 'VALID') {
    fail('REVIEW_INVALID_PROPOSAL', current.item_id);
  }
  if (command.decision === 'ACCEPTED' && RELATIONSHIP_KINDS.has(current.kind)) {
    validateEffectiveRelationship(current, state, analysis, legalSchema);
  }
  let citationSelection = null;
  if (command.decision === 'EDITED') {
    factContract(legalSchema, current.original.family_key, current.original.subtype_key,
      current.original.fact_type, command.roles || current.original.roles);
    citationSelection = proposalCitationSelection(current, command, analysis);
    validateTypedValue({
      fact_type: current.original.fact_type,
      value: command.value,
      source_span_ids: citationSelection.selected,
    }, citationSelection.spansById);
    validatePropositionGroupSelection(current, command, analysis);
  }
  const replacement = {
    ...current,
    decision: command.decision,
    reviewed_at: timestamp,
    edited_statement: command.decision === 'EDITED' ? command.statement.trim() : current.edited_statement || null,
    edited_roles: command.decision === 'EDITED' && command.roles && typeof command.roles === 'object'
      ? command.roles : current.edited_roles || null,
    edited_value: command.decision === 'EDITED' && command.value !== undefined
      ? command.value : current.edited_value ?? null,
    ...(command.decision === 'EDITED' && Object.hasOwn(command, 'proposition_group_id')
      ? { edited_proposition_group_id: command.proposition_group_id }
      : Object.hasOwn(current, 'edited_proposition_group_id')
        ? { edited_proposition_group_id: current.edited_proposition_group_id } : {}),
    source_span_ids: command.decision === 'EDITED' ? citationSelection.selected
      : current.kind === 'PROPOSAL' ? [...current.original.source_span_ids] : current.source_span_ids,
  };
  const items = [...state.items];
  items[index] = replacement;
  return { ...state, items };
}

function validateTypedValue(command, spansById) {
  if (command.value === undefined || command.value === null) return;
  const quote = command.source_span_ids.map((id) => spansById.get(id)?.exact_text || '').join('\n');
  let parsed = null;
  if (command.fact_type === 'FEE_AMOUNT') parsed = parseFeeAmount(quote);
  else if (command.fact_type === 'TAIL_PERIOD') parsed = parseTailPeriodMonths(quote);
  else if (command.fact_type === 'OUTSIDE_DATE') parsed = parseTerminationDeadline(quote);
  else if (['NOTICE_PERIOD', 'INITIAL_MATCH_PERIOD', 'SUBSEQUENT_MATCH_PERIOD', 'CURE_OR_NOTICE_PERIOD'].includes(command.fact_type)) parsed = parseNoShopPeriod(quote);
  if (parsed && (parsed.outcome !== 'RESOLVED'
    || String(parsed.iso_date || parsed.canonical_value) !== String(command.value).replace(/[$,]/g, ''))) {
    fail('REVIEW_FACT_VALUE', command.fact_type);
  }
}

function addMissingFact(state, command, analysis, timestamp, legalSchema) {
  const required = ['structure_node_id', 'source_closure_id', 'family_key', 'subtype_key', 'fact_type', 'statement'];
  for (const key of required) if (!command[key] || typeof command[key] !== 'string') fail('MISSING_FACT_FIELD', key);
  if (!command.roles || typeof command.roles !== 'object' || Array.isArray(command.roles)) fail('MISSING_FACT_FIELD', 'roles');
  factContract(legalSchema, command.family_key, command.subtype_key, command.fact_type, command.roles);
  if (!(analysis.agreement_structure?.nodes || []).some((node) => node.node_id === command.structure_node_id)) {
    fail('MISSING_FACT_FIELD', 'unknown structure_node_id');
  }
  if (!Array.isArray(command.source_span_ids) || command.source_span_ids.length === 0) fail('MISSING_FACT_SOURCE', 'source_span_ids');
  const spans = sourceSpanSet(analysis);
  if (command.source_span_ids.some((id) => !spans.has(id))) fail('MISSING_FACT_SOURCE', 'unknown span');
  const closure = (analysis.source_closures || []).find((item) => item.source_closure_id === command.source_closure_id);
  const closureSpans = new Set((analysis.spans || []).filter((span) => (span.source_closure_ids || []).includes(command.source_closure_id)).map((span) => span.span_id));
  if (!closure || command.source_span_ids.some((id) => !closureSpans.has(id))) fail('MISSING_FACT_SOURCE', 'span outside closure');
  validateTypedValue(command, new Map((analysis.spans || []).map((span) => [span.span_id, span])));
  const sourceId = sha256Hex([
    state.draft_analysis_id, command.structure_node_id, command.family_key, command.subtype_key,
    command.fact_type, command.statement.trim(), [...command.source_span_ids].sort().join(','),
  ].join('\u001f'));
  if (state.items.some((item) => item.source_id === sourceId)) fail('MISSING_FACT_DUPLICATE', sourceId);
  const item = makeItem('USER_FACT', sourceId, {
    structure_node_id: command.structure_node_id,
    family_key: command.family_key,
    source_closure_id: command.source_closure_id,
    source_span_ids: [...command.source_span_ids],
    original: {
      family_key: command.family_key,
      subtype_key: command.subtype_key,
      fact_type: command.fact_type,
      statement: command.statement.trim(),
      roles: command.roles,
      canonical_value: command.value ?? null,
      source_closure_id: command.source_closure_id,
      source_span_ids: [...command.source_span_ids],
    },
    edited_statement: command.statement.trim(),
    edited_roles: command.roles,
    decision: 'EDITED',
    reviewed_at: timestamp,
  });
  return { ...state, items: [...state.items, item].sort((left, right) => left.item_id.localeCompare(right.item_id)) };
}

function relationshipEndpointByItemId(state, itemId) {
  const item = state.items.find((candidate) => candidate.item_id === itemId);
  if (!item || !['PROPOSAL', 'USER_FACT'].includes(item.kind)) {
    fail('REVIEW_RELATIONSHIP_ENDPOINT', itemId || 'missing item ID');
  }
  return item;
}

function relationshipEndpointBySourceId(state, sourceId) {
  const item = state.items.find((candidate) => candidate.source_id === sourceId
    && ['PROPOSAL', 'USER_FACT'].includes(candidate.kind));
  if (!item) fail('REVIEW_RELATIONSHIP_ENDPOINT', sourceId || 'missing source ID');
  return item;
}

function relationshipTypeContract(endpoint, relationshipType, legalSchema) {
  if (!RELATIONSHIP_TYPES.includes(relationshipType)) {
    fail('REVIEW_RELATIONSHIP_TYPE', String(relationshipType));
  }
  const family = legalSchema?.families?.find((candidate) => (
    candidate.family_key === endpoint.original.family_key && candidate.state === 'DEFINED'
  ));
  const subtype = family?.subtypes?.find((candidate) => (
    candidate.subtype_key === endpoint.original.subtype_key
  ));
  if (!subtype || !subtype.relationships.includes(relationshipType)) {
    fail('REVIEW_RELATIONSHIP_TYPE', `${endpoint.original.family_key}.${endpoint.original.subtype_key}.${relationshipType}`);
  }
}

function validateRelationshipSource(sourceClosureId, sourceSpanIds, analysis) {
  if (typeof sourceClosureId !== 'string' || sourceClosureId.length === 0
    || !Array.isArray(sourceSpanIds) || sourceSpanIds.length === 0
    || sourceSpanIds.some((spanId) => typeof spanId !== 'string' || spanId.length === 0)
    || new Set(sourceSpanIds).size !== sourceSpanIds.length) {
    fail('REVIEW_RELATIONSHIP_SOURCE', 'one exact closure and one or more unique spans are required');
  }
  const spanIds = closureSpanIds(analysis, sourceClosureId);
  if (!spanIds || sourceSpanIds.some((spanId) => !spanIds.has(spanId))) {
    fail('REVIEW_RELATIONSHIP_SOURCE', 'span outside relationship closure');
  }
}

function effectiveRelationship(item) {
  const edited = item.edited_relationship;
  const values = edited && typeof edited === 'object' && !Array.isArray(edited)
    ? edited : item.original;
  return {
    schema_version: item.original.schema_version || 'PRODUCT_FACT_LINK/V1',
    fact_link_id: item.original.fact_link_id || item.source_id,
    from_proposal_id: values.from_proposal_id,
    to_proposal_id: values.to_proposal_id,
    relationship_type: values.relationship_type,
    source_closure_id: edited ? edited.source_closure_id : item.source_closure_id,
    source_span_ids: [...(edited ? edited.source_span_ids || [] : item.source_span_ids || [])],
  };
}

function relationshipItemIdentityValid(state, item, analysis) {
  if (item.edited_relationship !== null && item.edited_relationship !== undefined
    && canonicalJson(Object.keys(item.edited_relationship).sort()) !== canonicalJson([
      'from_proposal_id', 'relationship_type', 'source_closure_id', 'source_span_ids',
      'to_proposal_id',
    ].sort())) return false;
  if (item.kind === 'USER_RELATIONSHIP') {
    const keys = Object.keys(item.original || {}).sort();
    return canonicalJson(keys) === canonicalJson([
      'from_proposal_id', 'relationship_type', 'schema_version', 'source_closure_id',
      'source_span_ids', 'to_proposal_id',
    ].sort())
      && item.original.schema_version === USER_RELATIONSHIP_VERSION
      && expectedUserRelationshipSourceId(state, item.original) === item.source_id;
  }
  const raw = (analysis.fact_links || []).find((link) => link.fact_link_id === item.source_id);
  if (!raw) return false;
  const expectedKind = raw.relationship_type === 'EXCEPTS' ? 'EXCEPTION_LINK' : 'RELATIONSHIP';
  if (item.kind !== expectedKind || canonicalJson(item.original) !== canonicalJson(raw)) return false;
  return true;
}

function validateEffectiveRelationship(item, state, analysis, legalSchema) {
  const relationship = effectiveRelationship(item);
  const from = relationshipEndpointBySourceId(state, relationship.from_proposal_id);
  const to = relationshipEndpointBySourceId(state, relationship.to_proposal_id);
  if (from.item_id === to.item_id) fail('REVIEW_RELATIONSHIP_ENDPOINT', 'endpoints must differ');
  relationshipTypeContract(from, relationship.relationship_type, legalSchema);
  validateRelationshipSource(relationship.source_closure_id, relationship.source_span_ids, analysis);
  return { relationship, from, to };
}

function sameEffectiveRelationship(left, right) {
  return left.from_proposal_id === right.from_proposal_id
    && left.to_proposal_id === right.to_proposal_id
    && left.relationship_type === right.relationship_type
    && left.source_closure_id === right.source_closure_id
    && JSON.stringify([...left.source_span_ids].sort()) === JSON.stringify([...right.source_span_ids].sort());
}

function upsertRelationship(state, command, analysis, timestamp, legalSchema) {
  const from = relationshipEndpointByItemId(state, command.from_item_id);
  const to = relationshipEndpointByItemId(state, command.to_item_id);
  if (from.item_id === to.item_id) fail('REVIEW_RELATIONSHIP_ENDPOINT', 'endpoints must differ');
  const relationship = {
    from_proposal_id: from.source_id,
    to_proposal_id: to.source_id,
    relationship_type: command.relationship_type,
    source_closure_id: command.source_closure_id,
    source_span_ids: Array.isArray(command.source_span_ids) ? [...command.source_span_ids] : command.source_span_ids,
  };
  relationshipTypeContract(from, relationship.relationship_type, legalSchema);
  validateRelationshipSource(relationship.source_closure_id, relationship.source_span_ids, analysis);
  let current = null;
  if (command.item_id !== undefined) {
    current = state.items.find((item) => item.item_id === command.item_id);
    if (!current || !RELATIONSHIP_KINDS.has(current.kind)) {
      fail('REVIEW_RELATIONSHIP_ITEM', command.item_id || 'missing item ID');
    }
  }
  const duplicate = state.items.find((item) => RELATIONSHIP_KINDS.has(item.kind)
    && item.item_id !== current?.item_id && item.decision !== 'REJECTED'
    && sameEffectiveRelationship(effectiveRelationship(item), relationship));
  if (duplicate) fail('REVIEW_RELATIONSHIP_DUPLICATE', duplicate.item_id);
  if (current) {
    const replacement = {
      ...current,
      structure_node_id: from.structure_node_id,
      family_key: from.family_key,
      source_closure_id: relationship.source_closure_id,
      source_span_ids: [...relationship.source_span_ids],
      edited_relationship: relationship,
      decision: 'EDITED',
      reviewed_at: timestamp,
    };
    return {
      ...state,
      items: state.items.map((item) => item.item_id === current.item_id ? replacement : item),
    };
  }
  const sourceId = sha256Hex([
    USER_RELATIONSHIP_VERSION, state.draft_analysis_id, from.source_id, to.source_id,
    relationship.relationship_type, relationship.source_closure_id,
    [...relationship.source_span_ids].sort().join(','),
  ].join('\u001f'));
  if (state.items.some((item) => item.source_id === sourceId)) {
    fail('REVIEW_RELATIONSHIP_DUPLICATE', sourceId);
  }
  const item = makeItem('USER_RELATIONSHIP', sourceId, {
    structure_node_id: from.structure_node_id,
    family_key: from.family_key,
    source_closure_id: relationship.source_closure_id,
    source_span_ids: [...relationship.source_span_ids],
    original: {
      schema_version: USER_RELATIONSHIP_VERSION,
      ...relationship,
    },
    edited_relationship: null,
    decision: 'EDITED',
    reviewed_at: timestamp,
  });
  return { ...state, items: [...state.items, item].sort((left, right) => left.item_id.localeCompare(right.item_id)) };
}

function expectedUserRelationshipSourceId(state, relationship) {
  return sha256Hex([
    USER_RELATIONSHIP_VERSION, state.draft_analysis_id, relationship.from_proposal_id,
    relationship.to_proposal_id, relationship.relationship_type, relationship.source_closure_id,
    [...relationship.source_span_ids].sort().join(','),
  ].join('\u001f'));
}

function relationshipReviewIsCoherent(state, analysis, legalSchema) {
  try {
    for (const link of analysis.fact_links || []) {
      if (state.items.filter((item) => MODEL_RELATIONSHIP_KINDS.has(item.kind)
        && item.source_id === link.fact_link_id && relationshipItemIdentityValid(
        state, item, analysis,
      )).length !== 1) return false;
    }
    const effective = [];
    for (const item of state.items.filter((candidate) => RELATIONSHIP_KINDS.has(candidate.kind)
      && ['ACCEPTED', 'EDITED'].includes(candidate.decision))) {
      if (!relationshipItemIdentityValid(state, item, analysis)) return false;
      const resolved = validateEffectiveRelationship(item, state, analysis, legalSchema);
      if (!['ACCEPTED', 'EDITED'].includes(resolved.from.decision)
        || !['ACCEPTED', 'EDITED'].includes(resolved.to.decision)) return false;
      if (effective.some((relationship) => sameEffectiveRelationship(relationship, resolved.relationship))) {
        return false;
      }
      effective.push(resolved.relationship);
    }
    return true;
  } catch {
    return false;
  }
}

function compileReviewSummary(state, legalSchema, analysis) {
  for (const item of state.items.filter((candidate) => candidate.kind === 'PROPOSAL'
    && candidate.original.validation_status !== 'VALID')) {
    if (item.decision === 'ACCEPTED') fail('REVIEW_INVALID_PROPOSAL', item.item_id);
    if (item.decision === 'EDITED' && item.source_span_ids.length === 0) {
      fail('REVIEW_INVALID_PROPOSAL_SOURCE', item.item_id);
    }
  }
  const facts = state.items.filter((item) => ['PROPOSAL', 'USER_FACT'].includes(item.kind)
    && ['ACCEPTED', 'EDITED'].includes(item.decision)).map((item) => ({
    review_item_id: item.item_id,
    source_id: item.source_id,
    structure_node_id: item.structure_node_id,
    family_key: item.family_key,
    subtype_key: item.original.subtype_key,
    fact_type: item.original.fact_type,
    statement: item.edited_statement || item.original.statement,
    roles: item.edited_roles || item.original.roles,
    canonical_value: item.edited_value ?? item.original.canonical_value ?? null,
    proposition_group_id: Object.hasOwn(item, 'edited_proposition_group_id')
      ? item.edited_proposition_group_id : item.original.proposition_group_id || null,
    source_closure_id: item.source_closure_id,
    source_span_ids: [...item.source_span_ids],
  })).sort((left, right) => left.review_item_id.localeCompare(right.review_item_id));
  if (facts.some((fact) => !fact.source_closure_id || fact.source_span_ids.length === 0)) {
    fail('PUBLISHED_FACT_SOURCE', 'every published fact needs a closure and exact span');
  }
  const groups = new Map((analysis?.proposition_groups || [])
    .map((group) => [group.proposition_group_id, group]));
  for (const fact of facts.filter((candidate) => candidate.proposition_group_id !== null)) {
    const group = groups.get(fact.proposition_group_id);
    if (!group || group.family_key !== fact.family_key || group.subtype_key !== fact.subtype_key) {
      fail('REVIEW_PROPOSITION_GROUP', fact.review_item_id);
    }
  }
  for (const link of analysis.fact_links || []) {
    const matching = state.items.filter((item) => MODEL_RELATIONSHIP_KINDS.has(item.kind)
      && item.source_id === link.fact_link_id && relationshipItemIdentityValid(
      state, item, analysis,
    ));
    if (matching.length !== 1) fail('REVIEW_RELATIONSHIP_ITEM', link.fact_link_id);
  }
  const seenRelationships = [];
  const relationships = state.items.filter((item) => RELATIONSHIP_KINDS.has(item.kind)
    && ['ACCEPTED', 'EDITED'].includes(item.decision)).map((item) => {
    if (!relationshipItemIdentityValid(state, item, analysis)) {
      fail('REVIEW_RELATIONSHIP_ITEM', item.item_id);
    }
    const { relationship, from, to } = validateEffectiveRelationship(
      item, state, analysis, legalSchema,
    );
    if (!['ACCEPTED', 'EDITED'].includes(from.decision)
      || !['ACCEPTED', 'EDITED'].includes(to.decision)) {
      fail('PUBLISHED_RELATIONSHIP_ENDPOINT', item.item_id);
    }
    if (seenRelationships.some((candidate) => sameEffectiveRelationship(candidate, relationship))) {
      fail('REVIEW_RELATIONSHIP_DUPLICATE', item.item_id);
    }
    seenRelationships.push(relationship);
    return { review_item_id: item.item_id, ...relationship };
  }).sort((left, right) => left.review_item_id.localeCompare(right.review_item_id));
  const body = {
    schema_version: REVIEW_SUMMARY_VERSION,
    draft_analysis_id: state.draft_analysis_id,
    families: (legalSchema?.families || []).map((family) => family.family_key).map((familyKey) => ({
      family_key: familyKey,
      facts: facts.filter((fact) => fact.family_key === familyKey),
    })),
    relationships,
  };
  return { ...body, summary_id: contentId(REVIEW_SUMMARY_VERSION, body) };
}

function requireReviewTiming(state, { reviewHistory } = {}) {
  const timing = state.review_timing;
  if (timing !== undefined && timing !== null) {
    const accumulated = timing.accumulated_draft_seconds;
    const activeStart = timing.active_draft_started_at;
    if (timing.schema_version !== REVIEW_TIMING_VERSION
      || !Number.isSafeInteger(accumulated) || accumulated < 0
      || (state.status === 'DRAFT' && !Number.isFinite(Date.parse(activeStart || '')))
      || (state.status === 'PUBLISHED' && activeStart !== null)) {
      fail('REVIEW_TIMING', 'review timing state is invalid');
    }
    return { accumulatedDraftSeconds: accumulated, activeDraftStartedAt: activeStart };
  }
  if (state.status === 'PUBLISHED') {
    const accumulated = state.metrics?.review_time_seconds;
    if (!Number.isSafeInteger(accumulated) || accumulated < 0) {
      fail('REVIEW_TIMING', 'published review timing is unavailable');
    }
    return { accumulatedDraftSeconds: accumulated, activeDraftStartedAt: null };
  }
  if (reviewHistory?.hasPriorPublication === true) {
    const accumulated = reviewHistory.accumulatedDraftSeconds;
    const activeStart = reviewHistory.activeDraftStartedAt;
    if (!Number.isSafeInteger(accumulated) || accumulated < 0
      || !Number.isFinite(Date.parse(activeStart || ''))) {
      fail('REVIEW_TIMING', 'reopened review timing is unavailable');
    }
    return { accumulatedDraftSeconds: accumulated, activeDraftStartedAt: activeStart };
  }
  const initialStart = Date.parse(state.started_at);
  if (!Number.isFinite(initialStart)) fail('REVIEW_TIMING', 'initial review timing is unavailable');
  return { accumulatedDraftSeconds: 0, activeDraftStartedAt: state.started_at };
}

function compileMetrics(state, timestamp, options) {
  const timing = requireReviewTiming(state, options);
  const started = Date.parse(timing.activeDraftStartedAt);
  const ended = Date.parse(timestamp);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    fail('REVIEW_TIMING', 'active draft interval is invalid');
  }
  const reviewTimeSeconds = timing.accumulatedDraftSeconds + Math.round((ended - started) / 1000);
  return {
    schema_version: 'PRODUCT_REVIEW_METRICS/V1',
    proposal_count: state.items.filter((item) => item.kind === 'PROPOSAL').length,
    proposal_errors: state.items.filter((item) => item.kind === 'PROPOSAL' && ['EDITED', 'REJECTED'].includes(item.decision)).length,
    proposal_omissions: state.items.filter((item) => item.kind === 'USER_FACT').length,
    unresolved_count: state.items.filter((item) => item.decision === 'UNRESOLVED').length,
    review_time_seconds: reviewTimeSeconds,
  };
}

function prepareFindingResolutions(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('FINDING_RESOLUTION', 'finding_resolutions must be an array');
  const seen = new Set();
  return value.map((item) => {
    const findingItemId = typeof item?.finding_item_id === 'string' ? item.finding_item_id.trim() : '';
    if (!findingItemId || seen.has(findingItemId)) fail('FINDING_RESOLUTION', findingItemId || 'finding_item_id');
    seen.add(findingItemId);
    if (item.disposition === 'PUBLISHED_FACT') {
      const reviewItemId = typeof item.published_fact_review_item_id === 'string'
        ? item.published_fact_review_item_id.trim() : '';
      if (!reviewItemId) fail('FINDING_RESOLUTION', `${findingItemId}.published_fact_review_item_id`);
      return {
        finding_item_id: findingItemId,
        disposition: 'PUBLISHED_FACT',
        published_fact_review_item_id: reviewItemId,
        reviewed_by_role: 'LAWYER',
      };
    }
    if (item.disposition === 'REVIEWED_OMISSION') {
      const omissionReason = typeof item.omission_reason === 'string' ? item.omission_reason.trim() : '';
      if (!omissionReason) fail('FINDING_RESOLUTION', `${findingItemId}.omission_reason`);
      return {
        finding_item_id: findingItemId,
        disposition: 'REVIEWED_OMISSION',
        omission_reason: omissionReason,
        reviewed_by_role: 'LAWYER',
      };
    }
    fail('FINDING_RESOLUTION', `${findingItemId}.disposition`);
  });
}

function applyReviewCommand(state, command, { analysis, legalSchema, clock, timing, reviewHistory } = {}) {
  if (!command || typeof command !== 'object') fail('REVIEW_COMMAND', 'object required');
  const timestamp = nowIso(clock);
  if (command.type === 'EVALUATE_RELEASE') {
    if (state.status !== 'PUBLISHED') fail('REVIEW_NOT_PUBLISHED', state.status);
    if (command.lawyer_attestation !== true || command.independent_inventory_attestation !== true
      || typeof command.reviewer_identity !== 'string'
      || command.reviewer_identity.trim() === '') fail('LAWYER_ATTESTATION_REQUIRED', 'reviewer identity and attestation are required');
    if (!Array.isArray(command.inventory) || command.inventory.some((item) => (
      typeof item?.description !== 'string' || item.description.trim() === ''
    ))) fail('RELEASE_INVENTORY', 'each inventory item needs one atomic description');
    const inventory = command.inventory.map((item) => ({ ...item, description: item.description.trim() }));
    const reconciliation = Array.isArray(command.reconciliation)
      ? command.reconciliation.map((item) => ({ ...item, reviewed_by_role: 'LAWYER' })) : command.reconciliation;
    const citationAssessments = Array.isArray(command.citation_assessments)
      ? command.citation_assessments.map((item) => ({ ...item, reviewed_by_role: 'LAWYER' })) : command.citation_assessments;
    const findingResolutions = prepareFindingResolutions(command.finding_resolutions);
    const certifiedState = {
      ...state,
      items: state.items.map((item) => item.decision === 'PENDING' ? item : { ...item, decided_by_role: 'LAWYER' }),
      agreement_coverage: state.agreement_coverage.decision === 'ACCEPTED'
        ? { ...state.agreement_coverage, confirmed_by_role: 'LAWYER' } : state.agreement_coverage,
    };
    const releaseEvaluationInput = {
      inventory,
      reconciliation,
      citation_assessments: citationAssessments,
      finding_resolutions: findingResolutions,
      elapsed_minutes: command.elapsed_minutes,
      developer_assisted: command.developer_assisted,
      lawyer_attested_by: command.reviewer_identity.trim(),
      lawyer_attested_at: timestamp,
      independent_inventory_attested: true,
    };
    const releaseEvaluation = evaluateSupervisedRelease({
      inventory,
      reconciliation,
      analysis,
      reviewState: certifiedState,
      legalSchema,
      citationAssessments,
      findingResolutions,
      elapsedMinutes: command.elapsed_minutes,
      developerAssisted: command.developer_assisted,
      processingStartedAt: timing?.processingStartedAt,
      processingCompletedAt: timing?.processingCompletedAt,
    });
    return {
      ...certifiedState,
      release_evaluation_input: releaseEvaluationInput,
      release_evaluation: releaseEvaluation,
      updated_at: timestamp,
    };
  }
  if (command.type === 'ACTIVATE_RELEASE') {
    if (state.status !== 'PUBLISHED') fail('REVIEW_NOT_PUBLISHED', state.status);
    if (state.release_evaluation?.passed !== true) fail('RELEASE_EVALUATION_REQUIRED', 'fixed release bars must pass before activation');
    if (typeof command.release_id !== 'string' || command.release_id.trim() === '') fail('RELEASE_ID_REQUIRED', 'release_id is required');
    return { ...state, updated_at: timestamp };
  }
  if (command.type === 'ROLLBACK_RELEASE') {
    return { ...state, updated_at: timestamp };
  }
  if (command.type === 'REOPEN') {
    if (state.status !== 'PUBLISHED') fail('REVIEW_NOT_PUBLISHED', state.status);
    const timingState = requireReviewTiming(state);
    const reopenedAt = Date.parse(timestamp);
    const priorUpdatedAt = Date.parse(state.updated_at || state.published_at || '');
    if (!Number.isFinite(reopenedAt) || !Number.isFinite(priorUpdatedAt) || reopenedAt < priorUpdatedAt) {
      fail('REVIEW_TIMING', 'reopen timestamp is invalid');
    }
    return normaliseReviewRelationships({
      ...state,
      status: 'DRAFT',
      published_at: null,
      agreement_coverage: { decision: 'PENDING', reviewed_at: null },
      summary: null,
      metrics: null,
      review_timing: {
        schema_version: REVIEW_TIMING_VERSION,
        accumulated_draft_seconds: timingState.accumulatedDraftSeconds,
        active_draft_started_at: timestamp,
      },
      release_evaluation_input: null,
      release_evaluation: null,
      updated_at: timestamp,
    }, analysis);
  }
  state = normaliseReviewRelationships(state, analysis);
  requireDraft(state);
  let next = state;
  if (command.type === 'DECIDE_ITEM') next = decideItem(state, command, timestamp, legalSchema, analysis);
  else if (command.type === 'ADD_MISSING_FACT') next = addMissingFact(state, command, analysis, timestamp, legalSchema);
  else if (command.type === 'UPSERT_RELATIONSHIP') {
    next = upsertRelationship(state, command, analysis, timestamp, legalSchema);
  }
  else if (command.type === 'SAVE_PROGRESS') next = state;
  else if (command.type === 'CONFIRM_AGREEMENT_COVERAGE') {
    next = { ...state, agreement_coverage: { decision: command.confirmed === true ? 'ACCEPTED' : 'PENDING', reviewed_at: command.confirmed === true ? timestamp : null } };
  } else if (command.type === 'PUBLISH') {
    const pending = state.items.filter((item) => item.decision === 'PENDING');
    if (pending.length > 0) fail('REVIEW_PENDING_ITEMS', String(pending.length));
    const unresolved = state.items.filter((item) => item.decision === 'UNRESOLVED');
    if (unresolved.length > 0) fail('REVIEW_UNRESOLVED_ITEMS', String(unresolved.length));
    if (state.agreement_coverage.decision !== 'ACCEPTED') fail('AGREEMENT_COVERAGE_REQUIRED', 'confirm coverage before publication');
    const metrics = compileMetrics(state, timestamp, { reviewHistory });
    next = {
      ...state,
      status: 'PUBLISHED',
      published_at: timestamp,
      summary: compileReviewSummary(state, legalSchema, analysis),
      metrics,
      review_timing: {
        schema_version: REVIEW_TIMING_VERSION,
        accumulated_draft_seconds: metrics.review_time_seconds,
        active_draft_started_at: null,
      },
    };
  } else fail('REVIEW_COMMAND', String(command.type));
  return { ...next, updated_at: timestamp };
}

module.exports = {
  DECISIONS,
  ProductReviewError,
  REVIEW_ITEM_VERSION,
  REVIEW_STATE_VERSION,
  REVIEW_SUMMARY_VERSION,
  REVIEW_TIMING_VERSION,
  applyReviewCommand,
  compileReviewSummary,
  effectiveRelationship,
  initialiseReviewState,
  normaliseReviewRelationships,
  relationshipReviewIsCoherent,
};
