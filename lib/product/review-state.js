'use strict';

const { contentId, sha256Hex } = require('../canonical-v2/canonical-bytes');
const { parseFeeAmount, parseTailPeriodMonths } = require('../canonical-v2/native-producer/termination-fee-parse');
const { parseNoShopPeriod } = require('../canonical-v2/native-producer/no-shop-period-parse');
const { parseTerminationDeadline } = require('../canonical-v2/native-producer/termination-deadline-parse');
const { evaluateSupervisedRelease } = require('./release-evaluation');

const REVIEW_STATE_VERSION = 'PRODUCT_REVIEW_STATE/V1';
const REVIEW_ITEM_VERSION = 'PRODUCT_REVIEW_ITEM/V1';
const REVIEW_SUMMARY_VERSION = 'PRODUCT_REVIEW_SUMMARY/V1';
const DECISIONS = new Set(['ACCEPTED', 'EDITED', 'REJECTED', 'UNRESOLVED']);

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
  for (const link of (analysis.fact_links || []).filter((item) => item.relationship_type === 'EXCEPTS')) {
    const fromProposal = (analysis.proposals || []).find((item) => item.proposal_id === link.from_proposal_id);
    const toProposal = (analysis.proposals || []).find((item) => item.proposal_id === link.to_proposal_id);
    items.push(makeItem('EXCEPTION_LINK', link.fact_link_id, {
      structure_node_id: fromProposal?.structure_node_id || null,
      family_key: fromProposal?.family_key || null,
      source_closure_id: fromProposal?.source_closure_id || null,
      source_span_ids: link.source_span_ids.length ? [...link.source_span_ids]
        : [...new Set([...(fromProposal?.source_span_ids || []), ...(toProposal?.source_span_ids || [])])],
      original: link,
    }));
  }
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
  if (command.decision === 'EDITED') {
    factContract(legalSchema, current.original.family_key, current.original.subtype_key,
      current.original.fact_type, command.roles || current.original.roles);
    validateTypedValue({
      fact_type: current.original.fact_type,
      value: command.value,
      source_span_ids: current.source_span_ids,
    }, new Map((analysis.spans || []).map((span) => [span.span_id, span])));
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

function compileReviewSummary(state, legalSchema) {
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
    proposition_group_id: item.original.proposition_group_id || null,
    source_closure_id: item.source_closure_id,
    source_span_ids: [...item.source_span_ids],
  })).sort((left, right) => left.review_item_id.localeCompare(right.review_item_id));
  if (facts.some((fact) => !fact.source_closure_id || fact.source_span_ids.length === 0)) {
    fail('PUBLISHED_FACT_SOURCE', 'every published fact needs a closure and exact span');
  }
  const relationships = state.items.filter((item) => item.kind === 'EXCEPTION_LINK'
    && item.decision === 'ACCEPTED').map((item) => ({
    review_item_id: item.item_id,
    ...item.original,
    source_closure_id: item.source_closure_id,
    source_span_ids: [...item.source_span_ids],
  }));
  for (const relationship of relationships) {
    const from = state.items.find((item) => item.source_id === relationship.from_proposal_id);
    const to = state.items.find((item) => item.source_id === relationship.to_proposal_id);
    if (!from || !to || !['ACCEPTED', 'EDITED'].includes(from.decision) || !['ACCEPTED', 'EDITED'].includes(to.decision)) {
      fail('PUBLISHED_RELATIONSHIP_ENDPOINT', relationship.review_item_id);
    }
  }
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

function compileMetrics(state, timestamp) {
  const started = Date.parse(state.started_at);
  const ended = Date.parse(timestamp);
  return {
    schema_version: 'PRODUCT_REVIEW_METRICS/V1',
    proposal_count: state.items.filter((item) => item.kind === 'PROPOSAL').length,
    proposal_errors: state.items.filter((item) => item.kind === 'PROPOSAL' && ['EDITED', 'REJECTED'].includes(item.decision)).length,
    proposal_omissions: state.items.filter((item) => item.kind === 'USER_FACT').length,
    unresolved_count: state.items.filter((item) => item.decision === 'UNRESOLVED').length,
    review_time_seconds: Number.isFinite(started) && Number.isFinite(ended) ? Math.max(0, Math.round((ended - started) / 1000)) : null,
  };
}

function applyReviewCommand(state, command, { analysis, legalSchema, clock, timing } = {}) {
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
    return {
      ...state,
      status: 'DRAFT',
      published_at: null,
      agreement_coverage: { decision: 'PENDING', reviewed_at: null },
      summary: null,
      metrics: null,
      release_evaluation_input: null,
      release_evaluation: null,
      updated_at: timestamp,
    };
  }
  requireDraft(state);
  let next = state;
  if (command.type === 'DECIDE_ITEM') next = decideItem(state, command, timestamp, legalSchema, analysis);
  else if (command.type === 'ADD_MISSING_FACT') next = addMissingFact(state, command, analysis, timestamp, legalSchema);
  else if (command.type === 'SAVE_PROGRESS') next = state;
  else if (command.type === 'CONFIRM_AGREEMENT_COVERAGE') {
    next = { ...state, agreement_coverage: { decision: command.confirmed === true ? 'ACCEPTED' : 'PENDING', reviewed_at: command.confirmed === true ? timestamp : null } };
  } else if (command.type === 'PUBLISH') {
    const pending = state.items.filter((item) => item.decision === 'PENDING');
    if (pending.length > 0) fail('REVIEW_PENDING_ITEMS', String(pending.length));
    const unresolved = state.items.filter((item) => item.decision === 'UNRESOLVED');
    if (unresolved.length > 0) fail('REVIEW_UNRESOLVED_ITEMS', String(unresolved.length));
    if (state.agreement_coverage.decision !== 'ACCEPTED') fail('AGREEMENT_COVERAGE_REQUIRED', 'confirm coverage before publication');
    next = {
      ...state,
      status: 'PUBLISHED',
      published_at: timestamp,
      summary: compileReviewSummary(state, legalSchema),
      metrics: compileMetrics(state, timestamp),
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
  applyReviewCommand,
  compileReviewSummary,
  initialiseReviewState,
};
