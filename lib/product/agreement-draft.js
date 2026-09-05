'use strict';

const { canonicalJson, contentId, sha256Hex } = require('../canonical-v2/canonical-bytes');
const {
  classifyDeterministicSectionFamilies,
} = require('../canonical-v2/native-producer/section-family-classifier');
const { parseFeeAmount, parseTailPeriodMonths } = require('../canonical-v2/native-producer/termination-fee-parse');
const { parseNoShopPeriod } = require('../canonical-v2/native-producer/no-shop-period-parse');
const { parseTerminationDeadline } = require('../canonical-v2/native-producer/termination-deadline-parse');
const { validateLegalSchema, ABSENCE_STATES, RELATIONSHIP_TYPES } = require('./legal-schema');
const { REGISTERED_FAMILY_KEYS } = require('./family-taxonomy');
const {
  buildSourceClosure,
  residualParagraphSpans,
  sectionTitle,
  sourceClosureForModel,
  substantiveSections,
} = require('./source-context');

const DRAFT_VERSION = 'AGREEMENT_DRAFT/V1';
const MODEL_CALL_VERSION = 'PRODUCT_MODEL_CALL/V1';
const ROUTING_VERSION = 'PRODUCT_SECTION_ROUTING/V1';
const PROPOSAL_VERSION = 'PRODUCT_PROPOSAL/V1';
const GROUP_VERSION = 'PRODUCT_PROPOSITION_GROUP/V1';
const LINK_VERSION = 'PRODUCT_FACT_LINK/V1';
const ISSUE_VERSION = 'PRODUCT_ISSUE/V1';
const COVERAGE_VERSION = 'PRODUCT_COVERAGE_ASSERTION/V1';
const SECTION_DRAFT_VERSION = 'AGREEMENT_SECTION_DRAFT/V1';
const TARGET_FAMILIES = REGISTERED_FAMILY_KEYS;
const SECTION_DISPOSITIONS = new Set(['FAMILY_ASSIGNED', 'IMMATERIAL', 'UNRESOLVED_UNUSUAL_PROVISION']);
const RESIDUAL_DISPOSITIONS = new Set(['KNOWN_FAMILY', 'IMMATERIAL', 'UNRESOLVED_UNUSUAL_PROVISION']);
const RESIDUAL_PASS_VERSION = 'PRODUCT_PARAGRAPH_RESIDUAL_PASS/V1';
const PROVIDER_OMISSION_RATIONALE = 'PROVIDER_OMITTED_REQUIRED_PARAGRAPH_DISPOSITION';
const PROPOSAL_STATES = new Set(['PROPOSED', 'REJECTED', 'SUPERSEDED']);

class AgreementDraftError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'AgreementDraftError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new AgreementDraftError(code, detail);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) fail('MODEL_RESPONSE_SHAPE', label);
  return value;
}

function parseResponse(value, label) {
  if (plainObject(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (plainObject(parsed)) return parsed;
    } catch {}
  }
  fail('MODEL_RESPONSE_SHAPE', label);
}

function schemaFamilies(legalSchema) {
  return new Map(legalSchema.families.map((family) => [family.family_key, family]));
}

function routingFamilyContracts(legalSchema) {
  const families = schemaFamilies(legalSchema);
  return Object.fromEntries(TARGET_FAMILIES.map((familyKey) => {
    const family = families.get(familyKey);
    return [familyKey, {
      allowed_fact_types: family.required_fact_types,
      allowed_subtype_keys: family.subtypes.map((subtype) => subtype.subtype_key),
    }];
  }));
}

function subtypeContract(family, subtypeKey) {
  const subtype = family.subtypes.find((candidate) => candidate.subtype_key === subtypeKey);
  if (!subtype) fail('PROPOSAL_SUBTYPE', `${family.family_key}.${subtypeKey}`);
  return subtype;
}

function makeIssue({ kind, code, message, familyKey = null, subtypeKey = null, nodeId = null, proposalId = null, sourceClosureId = null, sourceSpanIds = [] }) {
  const body = {
    schema_version: ISSUE_VERSION,
    kind,
    code,
    message,
    family_key: familyKey,
    subtype_key: subtypeKey,
    structure_node_id: nodeId,
    proposal_id: proposalId,
    source_closure_id: sourceClosureId,
    source_span_ids: sourceSpanIds,
    state: 'OPEN',
  };
  return deepFreeze({ ...body, issue_id: contentId(ISSUE_VERSION, body) });
}

function compileResidualPass({ response, call, node, closure, paragraphs }) {
  if (!Array.isArray(response.paragraphs)) fail('MODEL_RESPONSE_SHAPE', `residual:${node.reference}`);
  const byId = new Map(paragraphs.map((span, paragraphIndex) => [span.span_id, { span, paragraphIndex }]));
  const seen = new Set();
  const returned = new Map();
  let priorParagraphIndex = -1;
  for (const item of response.paragraphs) {
    const entry = byId.get(item.source_span_id);
    if (!entry) fail('RESIDUAL_PARAGRAPH_UNKNOWN', typedJsonDetail(item.source_span_id));
    if (seen.has(item.source_span_id)) fail('RESIDUAL_PARAGRAPH_DUPLICATE', typedJsonDetail(item.source_span_id));
    if (entry.paragraphIndex <= priorParagraphIndex) fail('RESIDUAL_PARAGRAPH_ORDER', node.reference);
    seen.add(item.source_span_id);
    priorParagraphIndex = entry.paragraphIndex;
    if (!RESIDUAL_DISPOSITIONS.has(item.disposition)) fail('RESIDUAL_DISPOSITION', String(item.disposition));
    const familyKeys = canonicalRoutingSet(item.family_keys || [], 'residual.family_keys');
    if (familyKeys.some((key) => !TARGET_FAMILIES.includes(key))) fail('RESIDUAL_FAMILY', familyKeys.join(','));
    if ((item.disposition === 'KNOWN_FAMILY') !== (familyKeys.length > 0)) fail('RESIDUAL_FAMILY_CONSISTENCY', item.source_span_id);
    returned.set(item.source_span_id, {
      source_span_id: item.source_span_id,
      paragraph_index: entry.paragraphIndex,
      disposition: item.disposition,
      family_keys: familyKeys,
      rationale: requiredString(item.rationale, 'residual.rationale'),
    });
  }
  const dispositions = paragraphs.map((span, paragraphIndex) => returned.get(span.span_id) || {
    source_span_id: span.span_id,
    paragraph_index: paragraphIndex,
    disposition: 'UNRESOLVED_UNUSUAL_PROVISION',
    family_keys: [],
    rationale: PROVIDER_OMISSION_RATIONALE,
  });
  const body = {
    schema_version: RESIDUAL_PASS_VERSION,
    structure_node_id: node.node_id,
    section_reference: node.reference,
    source_closure_id: closure.source_closure_id,
    model_call_id: call.model_call_id,
    dispositions,
  };
  const residualPass = deepFreeze({ ...body, residual_pass_id: contentId(RESIDUAL_PASS_VERSION, body) });
  const issues = dispositions.filter((item) => item.disposition === 'UNRESOLVED_UNUSUAL_PROVISION').map((item) => makeIssue({
    kind: 'COVERAGE', code: 'UNRESOLVED_UNUSUAL_PROVISION', message: item.rationale,
    nodeId: node.node_id, sourceClosureId: closure.source_closure_id, sourceSpanIds: [item.source_span_id],
  }));
  const coverage = dispositions.map((item) => makeCoverage({
    subjectKind: 'RESIDUAL_PARAGRAPH', subjectId: item.source_span_id,
    state: item.disposition === 'UNRESOLVED_UNUSUAL_PROVISION' ? 'UNRESOLVED' : 'FOUND',
    nodeId: node.node_id, reason: item.disposition, modelCallId: call.model_call_id,
  }));
  return { residualPass, issues, coverage };
}

function makeCoverage({ subjectKind, subjectId, state, familyKey = null, subtypeKey = null, requiredRole = null, nodeId = null, reason = null, modelCallId = null }) {
  if (!ABSENCE_STATES.includes(state)) fail('COVERAGE_STATE', state);
  const body = {
    schema_version: COVERAGE_VERSION,
    subject_kind: subjectKind,
    subject_id: subjectId,
    family_key: familyKey,
    subtype_key: subtypeKey,
    required_role: requiredRole,
    structure_node_id: nodeId,
    state,
    reason,
    model_call_id: modelCallId,
    lawyer_confirmed: false,
  };
  return deepFreeze({ ...body, coverage_assertion_id: contentId(COVERAGE_VERSION, body) });
}

function sealSectionResult(result) {
  const sorted = (items, key) => [...items].sort((left, right) => String(left[key]).localeCompare(String(right[key])));
  const canonicalItems = (items, key) => sorted(uniqueById(items, key), key);
  const spans = canonicalItems(result.spans, 'span_id');
  const body = {
    schema_version: SECTION_DRAFT_VERSION,
    ...result,
    source_closure: { ...result.source_closure, spans },
    model_calls: canonicalItems(result.model_calls, 'model_call_id'),
    spans,
    proposals: canonicalItems(result.proposals, 'proposal_id'),
    groups: canonicalItems(result.groups, 'proposition_group_id'),
    links: canonicalItems(result.links, 'fact_link_id'),
    issues: canonicalItems(result.issues, 'issue_id'),
    coverage: canonicalItems(result.coverage, 'coverage_assertion_id'),
  };
  return deepFreeze({ ...body, section_result_id: contentId(SECTION_DRAFT_VERSION, body) });
}

function modelInvocationId(attemptToken, kind) {
  if (!attemptToken) return null;
  return sha256Hex(['PRODUCT_MODEL_INVOCATION/V1', attemptToken, kind].join('\x1f'));
}

async function invokeModel(model, {
  kind, promptVersion, request, nodeId, attemptToken = null, onModelCall = null,
}) {
  if (!model || typeof model.complete !== 'function') fail('MODEL_REQUIRED', 'model.complete is required');
  if (onModelCall !== null && typeof onModelCall !== 'function') fail('MODEL_CALL_CALLBACK', 'onModelCall must be a function');
  const started = Date.now();
  const result = await model.complete({ call_kind: kind, prompt_version: promptVersion, request });
  if (!plainObject(result)) fail('MODEL_RESULT', `${kind}:${nodeId}`);
  const response = parseResponse(result.response ?? result.raw_response, `${kind}:${nodeId}`);
  const rawRequest = result.raw_request === undefined ? request : result.raw_request;
  const rawResponse = result.raw_response === undefined ? response : result.raw_response;
  const metrics = {
    input_tokens: Number.isSafeInteger(result.input_tokens) && result.input_tokens >= 0 ? result.input_tokens : 0,
    output_tokens: Number.isSafeInteger(result.output_tokens) && result.output_tokens >= 0 ? result.output_tokens : 0,
    cost_microusd: Number.isSafeInteger(result.cost_microusd) && result.cost_microusd >= 0 ? result.cost_microusd : 0,
    duration_ms: Number.isSafeInteger(result.duration_ms) && result.duration_ms >= 0 ? result.duration_ms : Math.max(0, Date.now() - started),
  };
  const body = {
    schema_version: MODEL_CALL_VERSION,
    call_kind: kind,
    prompt_version: promptVersion,
    provider_id: requiredString(result.provider_id, `${kind}.provider_id`),
    model_id: requiredString(result.model_id, `${kind}.model_id`),
    structure_node_id: nodeId,
    request: rawRequest,
    response: rawResponse,
    ...(attemptToken ? { invocation_id: modelInvocationId(attemptToken, kind) } : {}),
    ...metrics,
  };
  const call = deepFreeze({ ...body, model_call_id: contentId(MODEL_CALL_VERSION, body) });
  if (onModelCall) await onModelCall(call);
  return deepFreeze({ call, response });
}

function uniqueStrings(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) fail('MODEL_RESPONSE_SHAPE', label);
  return [...new Set(value)];
}

function typedJsonDetail(value) {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  try {
    return canonicalJson({ type, value });
  } catch {
    return canonicalJson({ type, value: null, representation: String(value) });
  }
}

function canonicalRoutingSet(value, label) {
  return uniqueStrings(value, label).sort((left, right) => left.localeCompare(right));
}

function canonicalLinkSourceSpanIds(value) {
  return canonicalRoutingSet(value, 'link.source_span_ids');
}

function canonicalProposalSourceSpanIds(value) {
  return canonicalRoutingSet(value, 'proposal.source_span_ids');
}

function canonicalRoutingDisagreements(value) {
  if (!Array.isArray(value)) return [];
  const byCanonicalValue = new Map();
  for (const item of value) {
    if (!plainObject(item) || canonicalJson(Object.keys(item).sort()) !== canonicalJson(['family_key', 'reason'])) {
      fail('ROUTING_DISAGREEMENT_SHAPE', typedJsonDetail(item));
    }
    requiredString(item.family_key, 'routing.deterministic_disagreements[].family_key');
    requiredString(item.reason, 'routing.deterministic_disagreements[].reason');
    if (!TARGET_FAMILIES.includes(item.family_key)) continue;
    const key = canonicalJson(item);
    if (!byCanonicalValue.has(key)) byCanonicalValue.set(key, item);
  }
  return [...byCanonicalValue.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, item]) => item);
}

function canonicalRoutingDisposition(value, families = []) {
  if (Array.isArray(value) && value.length === 1
    && typeof value[0] === 'string' && SECTION_DISPOSITIONS.has(value[0])) return value[0];
  if (Array.isArray(value) && value.length === 2 && families.length > 0
    && new Set(value).size === 2 && value.includes('FAMILY_ASSIGNED') && value.includes('IMMATERIAL')) {
    return 'FAMILY_ASSIGNED';
  }
  return value;
}

function compileRouting({ response, call, node, deterministicEvidence }) {
  const families = canonicalRoutingSet(response.families, 'routing.families');
  if (families.some((family) => !TARGET_FAMILIES.includes(family))) fail('ROUTING_FAMILY', families.join(','));
  const disposition = canonicalRoutingDisposition(response.disposition, families);
  if (!SECTION_DISPOSITIONS.has(disposition)) fail('ROUTING_DISPOSITION', typedJsonDetail(response.disposition));
  if ((families.length > 0) !== (disposition === 'FAMILY_ASSIGNED')) {
    fail('ROUTING_CONSISTENCY', node.reference);
  }
  const disagreements = canonicalRoutingDisagreements(response.deterministic_disagreements);
  for (const evidence of deterministicEvidence) {
    if (families.includes(evidence.section_family)) continue;
    const disagreement = disagreements.find((item) => item?.family_key === evidence.section_family
      && typeof item.reason === 'string' && item.reason.trim().length > 0);
    if (!disagreement) fail('ROUTING_EVIDENCE_UNRECONCILED', `${node.reference}:${evidence.section_family}`);
  }
  const body = {
    schema_version: ROUTING_VERSION,
    structure_node_id: node.node_id,
    section_reference: node.reference,
    model_call_id: call.model_call_id,
    deterministic_evidence: deterministicEvidence,
    deterministic_disagreements: disagreements,
    families,
    disposition,
    rationale: typeof response.rationale === 'string' ? response.rationale : null,
  };
  return deepFreeze({ ...body, section_routing_id: contentId(ROUTING_VERSION, body) });
}

function resolveEvidenceQuote(sourceDocument, closure, evidence) {
  const quote = requiredString(evidence?.quote, 'proposal.evidence_quotes[].quote');
  const sourceSpanId = requiredString(evidence?.source_span_id, 'proposal.evidence_quotes[].source_span_id');
  const allowed = closure.spans.find((span) => span.span_id === sourceSpanId);
  if (!allowed) fail('PROPOSAL_EVIDENCE_COMPONENT', sourceSpanId);
  const occurrence = evidence.occurrence;
  const context = {
    quote,
    occurrence,
    source_span_id: sourceSpanId,
    component_kind: allowed.kind,
    component_structure_node_id: allowed.structure_node_id,
  };
  if (!Number.isSafeInteger(occurrence) || occurrence < 0) {
    return { context: { ...context, reason: 'INVALID_OCCURRENCE' }, span: null };
  }
  const sourceBytes = Buffer.from(sourceDocument.canonical_text, 'utf8');
  const quoteBytes = Buffer.from(quote, 'utf8');
  const matches = [];
  let cursor = allowed.start_byte;
  while (cursor <= allowed.end_byte - quoteBytes.length) {
    const found = sourceBytes.indexOf(quoteBytes, cursor);
    if (found < 0 || found + quoteBytes.length > allowed.end_byte) break;
    matches.push({ start: found, end: found + quoteBytes.length });
    cursor = found + Math.max(1, quoteBytes.length);
  }
  const unique = [...new Map(matches.map((match) => [`${match.start}:${match.end}`, match])).values()]
    .sort((left, right) => left.start - right.start);
  if (occurrence >= unique.length) {
    return { context: { ...context, reason: 'NOT_EXACT_CONTIGUOUS_SOURCE_TEXT' }, span: null };
  }
  const match = unique[occurrence];
  const identity = {
    source_document_id: sourceDocument.source_document_id,
    kind: 'SUPPORTING_EVIDENCE',
    structure_node_id: closure.structure_node_id,
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte: match.start,
    end_byte: match.end,
    text_sha256: sha256Hex(quoteBytes),
  };
  return {
    context,
    span: deepFreeze({
    schema_version: 'PRODUCT_SOURCE_SPAN/V1',
    span_id: contentId('PRODUCT_SOURCE_SPAN/V1', identity),
    ...identity,
    kind: 'SUPPORTING_EVIDENCE',
    structure_node_id: closure.structure_node_id,
    exact_text: quote,
    }),
  };
}

function valueValidation(proposal, spans) {
  const quote = spans[0]?.exact_text;
  if (!quote) return { value: proposal.value ?? null, issue: 'NO_SUPPORTING_SPAN' };
  let parsed = null;
  if (proposal.fact_type === 'FEE_AMOUNT') parsed = parseFeeAmount(quote);
  else if (proposal.fact_type === 'TAIL_PERIOD') parsed = parseTailPeriodMonths(quote);
  else if (proposal.fact_type === 'OUTSIDE_DATE') parsed = parseTerminationDeadline(quote);
  else if (['NOTICE_PERIOD', 'INITIAL_MATCH_PERIOD', 'SUBSEQUENT_MATCH_PERIOD', 'CURE_OR_NOTICE_PERIOD'].includes(proposal.fact_type)) {
    parsed = parseNoShopPeriod(quote);
  }
  if (!parsed) return { value: proposal.value ?? null, issue: null };
  if (parsed.outcome !== 'RESOLVED') return { value: proposal.value ?? null, issue: `VALUE_${parsed.reason}` };
  const value = parsed.iso_date || parsed.canonical_value;
  if (proposal.value !== undefined && proposal.value !== null
    && String(proposal.value).replace(/[$,]/g, '') !== String(value)) {
    return { value, issue: 'VALUE_MODEL_MISMATCH' };
  }
  return { value, issue: null };
}

function compileExtraction({ sourceDocument, legalSchema, node, closure, call, response, routedFamilies }) {
  const families = schemaFamilies(legalSchema);
  if (!Array.isArray(response.proposals) || !Array.isArray(response.groups) || !Array.isArray(response.links)
    || !plainObject(response.coverage) || !plainObject(response.fact_type_coverage)) {
    fail('MODEL_RESPONSE_SHAPE', `extraction:${node.reference}`);
  }
  const rawGroups = new Map();
  for (const group of response.groups) {
    const ref = requiredString(group.client_ref, 'group.client_ref');
    if (rawGroups.has(ref)) fail('GROUP_DUPLICATE', ref);
    if (!routedFamilies.includes(group.family_key)) fail('GROUP_FAMILY', ref);
    subtypeContract(families.get(group.family_key), group.subtype_key);
    rawGroups.set(ref, group);
  }

  const spansById = new Map(closure.spans.map((span) => [span.span_id, span]));
  const issues = [];
  for (const incompatibility of (response.provider_incompatibilities || [])) {
    if (!routedFamilies.includes(incompatibility.family_key) || !spansById.has(incompatibility.source_span_id)) fail('PROVIDER_INCOMPATIBILITY_SOURCE', incompatibility.code || 'unknown');
    issues.push(makeIssue({ kind: 'VALIDATION', code: requiredString(incompatibility.code, 'provider_incompatibility.code'), message: requiredString(incompatibility.message, 'provider_incompatibility.message'), familyKey: incompatibility.family_key, nodeId: node.node_id, sourceClosureId: closure.source_closure_id, sourceSpanIds: [incompatibility.source_span_id] }));
  }
  const temporary = [];
  const proposalRefs = new Map();
  for (const proposal of response.proposals) {
    const clientRef = requiredString(proposal.client_ref, 'proposal.client_ref');
    if (proposalRefs.has(clientRef)) fail('PROPOSAL_DUPLICATE_REF', clientRef);
    const family = families.get(proposal.family_key);
    if (!family || !routedFamilies.includes(proposal.family_key)) fail('PROPOSAL_FAMILY', clientRef);
    const subtype = subtypeContract(family, proposal.subtype_key);
    if (!family.required_fact_types.includes(proposal.fact_type)) fail('PROPOSAL_FACT_TYPE', `${proposal.family_key}.${proposal.fact_type}`);
    if (!rawGroups.has(proposal.group_ref)) fail('PROPOSAL_GROUP', clientRef);
    if (!plainObject(proposal.roles)) fail('PROPOSAL_ROLES', clientRef);
    const evidence = Array.isArray(proposal.evidence_quotes) ? proposal.evidence_quotes : [];
    if (evidence.length === 0) fail('PROPOSAL_EVIDENCE', clientRef);
    const evidenceResults = evidence.map((item) => resolveEvidenceQuote(sourceDocument, closure, item));
    const exactOwned = evidenceResults.some((item) => item.span
      && item.context.component_structure_node_id === node.node_id);
    const evidenceSpans = exactOwned ? evidenceResults.filter((item) => item.span).map((item) => item.span) : [];
    evidenceSpans.forEach((span) => spansById.set(span.span_id, span));
    const unmatchedEvidence = evidenceResults.filter((item) => !item.span).map((item) => item.context);
    const contextOnlyEvidence = evidenceResults.filter((item) => item.context.component_structure_node_id !== node.node_id)
      .map((item) => item.context);
    const missingRoles = subtype.required_roles.filter((role) => proposal.roles[role] === undefined
      || proposal.roles[role] === null || proposal.roles[role] === '');
    const normalized = valueValidation(proposal, evidenceSpans);
    const proposalSourceSpanIds = canonicalProposalSourceSpanIds(evidenceSpans.map((span) => span.span_id));
    const occurrenceBody = {
      source_document_id: sourceDocument.source_document_id,
      family_key: proposal.family_key,
      subtype_key: proposal.subtype_key,
      fact_type: proposal.fact_type,
      source_span_ids: proposalSourceSpanIds,
    };
    const evidenceInvalid = unmatchedEvidence.length > 0 || !exactOwned;
    if (evidenceInvalid) {
      occurrenceBody.invalid_evidence_occurrence_id = contentId('PRODUCT_INVALID_EVIDENCE_OCCURRENCE/V1', {
        client_ref: clientRef,
        evidence: evidenceResults.map((item) => item.context),
      });
    }
    const factOccurrenceId = contentId('PRODUCT_FACT_OCCURRENCE/V1', occurrenceBody);
    const temporaryProposal = {
      client_ref: clientRef,
      group_ref: proposal.group_ref,
      family_key: proposal.family_key,
      subtype_key: proposal.subtype_key,
      fact_type: proposal.fact_type,
      statement: requiredString(proposal.statement, 'proposal.statement'),
      roles: proposal.roles,
      canonical_value: normalized.value,
      source_span_ids: proposalSourceSpanIds,
      source_closure_id: closure.source_closure_id,
      model_call_id: call.model_call_id,
      fact_occurrence_id: factOccurrenceId,
      structure_node_id: node.node_id,
      state: PROPOSAL_STATES.has(proposal.state) ? proposal.state : 'PROPOSED',
      validation_status: missingRoles.length === 0 && !normalized.issue && !evidenceInvalid ? 'VALID' : 'INVALID',
    };
    if (evidenceInvalid) {
      temporaryProposal.invalid_evidence_occurrence_id = occurrenceBody.invalid_evidence_occurrence_id;
      if (unmatchedEvidence.length > 0) temporaryProposal.unmatched_evidence = unmatchedEvidence;
      if (contextOnlyEvidence.length > 0) temporaryProposal.context_only_evidence = contextOnlyEvidence;
    }
    temporary.push(temporaryProposal);
    proposalRefs.set(clientRef, temporaryProposal);
    for (const role of missingRoles) {
      issues.push(makeIssue({ kind: 'VALIDATION', code: 'MISSING_REQUIRED_ROLE', message: role, familyKey: proposal.family_key, subtypeKey: proposal.subtype_key, nodeId: node.node_id }));
    }
    if (normalized.issue) {
      issues.push(makeIssue({ kind: 'VALIDATION', code: normalized.issue, message: clientRef, familyKey: proposal.family_key, subtypeKey: proposal.subtype_key, nodeId: node.node_id }));
    }
  }

  const groups = [];
  const groupIds = new Map();
  for (const [ref, raw] of rawGroups) {
    const members = temporary.filter((proposal) => proposal.group_ref === ref);
    if (members.length === 0) {
      issues.push(makeIssue({ kind: 'VALIDATION', code: 'EMPTY_PROPOSITION_GROUP', message: ref, familyKey: raw.family_key, subtypeKey: raw.subtype_key, nodeId: node.node_id }));
      continue;
    }
    if (members.some((proposal) => proposal.family_key !== raw.family_key || proposal.subtype_key !== raw.subtype_key)) {
      issues.push(makeIssue({ kind: 'VALIDATION', code: 'GROUP_MEMBER_MISMATCH', message: ref, familyKey: raw.family_key, subtypeKey: raw.subtype_key, nodeId: node.node_id }));
    }
    const body = {
      schema_version: GROUP_VERSION,
      source_document_id: sourceDocument.source_document_id,
      structure_node_id: node.node_id,
      family_key: raw.family_key,
      subtype_key: raw.subtype_key,
      fact_occurrence_ids: members.map((proposal) => proposal.fact_occurrence_id).sort(),
      source_closure_id: closure.source_closure_id,
    };
    const group = deepFreeze({ ...body, proposition_group_id: contentId(GROUP_VERSION, body) });
    groups.push(group);
    groupIds.set(ref, group.proposition_group_id);
  }

  const proposals = temporary.map((proposal) => {
    const { client_ref: clientRef, group_ref: groupRef, ...bodyBase } = proposal;
    const body = {
      schema_version: PROPOSAL_VERSION,
      ...bodyBase,
      proposition_group_id: groupIds.get(groupRef) || null,
    };
    const compiled = deepFreeze({ ...body, proposal_id: contentId(PROPOSAL_VERSION, body) });
    proposalRefs.set(clientRef, compiled);
    return compiled;
  });

  for (const proposal of proposals) {
    if (proposal.unmatched_evidence?.length > 0) {
      issues.push(makeIssue({
        kind: 'VALIDATION', code: 'PROPOSAL_EVIDENCE_NOT_EXACT',
        message: proposal.invalid_evidence_occurrence_id, familyKey: proposal.family_key,
        subtypeKey: proposal.subtype_key, nodeId: node.node_id, proposalId: proposal.proposal_id,
        sourceClosureId: closure.source_closure_id,
        sourceSpanIds: canonicalProposalSourceSpanIds(proposal.unmatched_evidence.map((item) => item.source_span_id)),
      }));
    }
    const hasOwnedEvidence = proposal.source_span_ids.length > 0;
    if (!hasOwnedEvidence) {
      issues.push(makeIssue({
        kind: 'VALIDATION', code: 'PROPOSAL_CONTEXT_ONLY',
        message: proposal.invalid_evidence_occurrence_id, familyKey: proposal.family_key,
        subtypeKey: proposal.subtype_key, nodeId: node.node_id, proposalId: proposal.proposal_id,
        sourceClosureId: closure.source_closure_id,
        sourceSpanIds: canonicalProposalSourceSpanIds((proposal.context_only_evidence || []).map((item) => item.source_span_id)),
      }));
    }
  }

  const links = response.links.map((link) => {
    const from = proposalRefs.get(link.from_ref);
    const to = proposalRefs.get(link.to_ref);
    if (!from || !to) fail('FACT_LINK_ENDPOINT', `${link.from_ref}:${link.to_ref}`);
    const relationshipType = Array.isArray(link.relationship_type)
      && link.relationship_type.length === 1 && typeof link.relationship_type[0] === 'string'
      ? link.relationship_type[0] : link.relationship_type;
    if (Array.isArray(link.relationship_type) && (link.relationship_type.length !== 1 || typeof link.relationship_type[0] !== 'string')) {
      fail('FACT_LINK_TYPE', typedJsonDetail(link.relationship_type));
    }
    if (!RELATIONSHIP_TYPES.includes(relationshipType)) fail('FACT_LINK_TYPE', typedJsonDetail(link.relationship_type));
    const fromSubtype = subtypeContract(families.get(from.family_key), from.subtype_key);
    if (!fromSubtype.relationships.includes(relationshipType)) {
      issues.push(makeIssue({ kind: 'VALIDATION', code: 'RELATIONSHIP_NOT_ALLOWED', message: relationshipType, familyKey: from.family_key, subtypeKey: from.subtype_key, nodeId: node.node_id, proposalId: from.proposal_id }));
    }
    const body = {
      schema_version: LINK_VERSION,
      from_proposal_id: from.proposal_id,
      to_proposal_id: to.proposal_id,
      relationship_type: relationshipType,
      source_span_ids: canonicalLinkSourceSpanIds(link.source_span_ids || []),
    };
    if (body.source_span_ids.some((id) => !spansById.has(id))) fail('FACT_LINK_SPAN', relationshipType);
    return deepFreeze({ ...body, fact_link_id: contentId(LINK_VERSION, body) });
  });

  const coverage = [];
  for (const familyKey of routedFamilies) {
    let state = response.coverage[familyKey];
    if (!ABSENCE_STATES.includes(state)) fail('COVERAGE_STATE', `${node.reference}:${familyKey}`);
    const familyProposals = proposals.filter((proposal) => proposal.family_key === familyKey);
    const hasInvalid = familyProposals.some((proposal) => proposal.validation_status !== 'VALID')
      || issues.some((issue) => issue.family_key === familyKey);
    if (hasInvalid || (state === 'FOUND' && familyProposals.length === 0)
      || (state === 'NOT_FOUND' && familyProposals.length > 0)) state = 'UNRESOLVED';
    coverage.push(makeCoverage({ subjectKind: 'SECTION_FAMILY', subjectId: `${node.node_id}:${familyKey}`, state, familyKey, nodeId: node.node_id, reason: response.coverage_reason?.[familyKey] || null, modelCallId: routedFamilies.includes(familyKey) ? call.model_call_id : null }));
    const family = families.get(familyKey);
    for (const factType of family.required_fact_types) {
      let factState = response.fact_type_coverage?.[familyKey]?.[factType];
      if (!['FOUND', 'NOT_FOUND', 'UNRESOLVED'].includes(factState)) {
        fail('COVERAGE_STATE', `${node.reference}:${familyKey}:${factType}`);
      }
      const hasValidProposal = familyProposals.some((proposal) => proposal.fact_type === factType
        && proposal.validation_status === 'VALID');
      const hasAnyProposal = familyProposals.some((proposal) => proposal.fact_type === factType);
      if ((factState === 'FOUND' && !hasValidProposal) || (factState === 'NOT_FOUND' && hasAnyProposal)) {
        factState = 'UNRESOLVED';
      }
      coverage.push(makeCoverage({
        subjectKind: 'FACT_TYPE', subjectId: `${node.node_id}:${familyKey}:${factType}`, state: factState,
        familyKey, nodeId: node.node_id, reason: `FACT_TYPE:${factType}`,
        modelCallId: routedFamilies.includes(familyKey) ? call.model_call_id : null,
      }));
    }
  }
  for (const proposal of proposals) {
    const subtype = subtypeContract(families.get(proposal.family_key), proposal.subtype_key);
    for (const role of subtype.required_roles) {
      coverage.push(makeCoverage({
        subjectKind: 'ROLE', subjectId: `${proposal.fact_occurrence_id}:${role}`,
        state: proposal.roles[role] === undefined || proposal.roles[role] === null || proposal.roles[role] === '' ? 'UNRESOLVED' : 'FOUND',
        familyKey: proposal.family_key, subtypeKey: proposal.subtype_key, requiredRole: role,
        nodeId: node.node_id, modelCallId: call.model_call_id,
      }));
    }
  }
  return { proposals, groups, links, issues, coverage, spans: [...spansById.values()] };
}

function deterministicEvidence(sourceDocument, node) {
  const text = Buffer.from(sourceDocument.canonical_text, 'utf8')
    .subarray(node.span.start_byte, node.span.end_byte).toString('utf8');
  return classifyDeterministicSectionFamilies({
    title: sectionTitle(sourceDocument, node),
    source_text: text,
  }).filter((item) => TARGET_FAMILIES.includes(item.section_family));
}

async function buildAgreementSectionDraft({
  sourceDocument, agreementStructure, legalSchema, model, node, attemptToken = null, onModelCall = null,
}) {
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  const evidence = deterministicEvidence(sourceDocument, node);
  const routingRequest = {
    instruction: 'Classify this complete substantive section semantically. Return every applicable family only when the section contains relevant evidence for an allowed fact type, a condition or exception that changes one, or an express absence statement about one. A generic defined term outside a family\'s allowed fact types does not assign that family. Preserve uncertain material evidence as unresolved. Deterministic labels are evidence only.',
    allowed_families: TARGET_FAMILIES,
    family_routing_contracts: routingFamilyContracts(legalSchema),
    section_reference: node.reference,
    section: sourceClosureForModel(closure).full_section,
    deterministic_family_evidence: evidence,
    response_contract: {
      families: TARGET_FAMILIES,
      disposition: [...SECTION_DISPOSITIONS],
      rationale: 'string',
      deterministic_disagreements: [{ family_key: 'deterministic family omitted from families', reason: 'evidence-based reason' }],
    },
  };
  const routingCall = await invokeModel(model, {
    kind: 'ROUTING', promptVersion: 'PRODUCT_MULTI_LABEL_ROUTER/V2', request: routingRequest,
    nodeId: node.node_id, attemptToken, onModelCall,
  });
  const routing = compileRouting({ response: routingCall.response, call: routingCall.call, node, deterministicEvidence: evidence });
  const paragraphs = residualParagraphSpans({ sourceDocument, closure });
  const residualRequest = {
    instruction: 'Review every paragraph independently for material legal provisions missed by the 25-family catalogue. Do not infer meaning from keywords. Return one disposition for every paragraph.',
    allowed_families: TARGET_FAMILIES,
    section_reference: node.reference,
    routed_families: routing.families,
    paragraphs: paragraphs.map((span, paragraphIndex) => ({
      paragraph_index: paragraphIndex,
      source_span_id: span.span_id,
      exact_text: span.exact_text,
    })),
    response_contract: {
      paragraphs: [{
        source_span_id: 'exact input paragraph span ID',
        disposition: [...RESIDUAL_DISPOSITIONS],
        family_keys: TARGET_FAMILIES,
        rationale: 'source-based reason',
      }],
    },
  };
  const residualCall = await invokeModel(model, {
    kind: 'RESIDUAL', promptVersion: 'PRODUCT_PARAGRAPH_RESIDUAL/V1', request: residualRequest,
    nodeId: node.node_id, attemptToken, onModelCall,
  });
  const residual = compileResidualPass({ response: residualCall.response, call: residualCall.call, node, closure, paragraphs });
  const baseCoverage = TARGET_FAMILIES.map((familyKey) => makeCoverage({
    subjectKind: 'SECTION_FAMILY', subjectId: `${node.node_id}:${familyKey}`,
    state: routing.families.includes(familyKey) ? 'FOUND' : 'NOT_FOUND', familyKey,
    nodeId: node.node_id, reason: routing.disposition, modelCallId: routingCall.call.model_call_id,
  }));
  const familyMap = schemaFamilies(legalSchema);
  const sectionCoverage = makeCoverage({
    subjectKind: 'SECTION', subjectId: node.node_id,
    state: routing.disposition === 'UNRESOLVED_UNUSUAL_PROVISION' ? 'UNRESOLVED'
      : routing.disposition === 'IMMATERIAL' ? 'NOT_FOUND' : 'FOUND',
    nodeId: node.node_id, reason: routing.disposition, modelCallId: routingCall.call.model_call_id,
  });
  const closureIncomplete = !closure.context_diagnostics.traversal_complete
    || closure.context_diagnostics.unresolved_section_references.length > 0;
  if (closureIncomplete) {
    const issue = makeIssue({
      kind: 'COVERAGE', code: 'SOURCE_CLOSURE_INCOMPLETE',
      message: canonicalJson(closure.context_diagnostics), nodeId: node.node_id,
    });
    const coverage = [sectionCoverage, ...TARGET_FAMILIES.flatMap((familyKey) => {
      const state = routing.families.includes(familyKey) ? 'UNRESOLVED' : 'NOT_FOUND';
      return [makeCoverage({ subjectKind: 'SECTION_FAMILY', subjectId: `${node.node_id}:${familyKey}`, state, familyKey, nodeId: node.node_id, reason: issue.code, modelCallId: routingCall.call.model_call_id }),
        ...(routing.families.includes(familyKey) ? familyMap.get(familyKey).required_fact_types.map((factType) => makeCoverage({
          subjectKind: 'FACT_TYPE', subjectId: `${node.node_id}:${familyKey}:${factType}`, state, familyKey,
          nodeId: node.node_id, reason: `FACT_TYPE:${factType}`, modelCallId: routingCall.call.model_call_id,
        })) : [])];
    })];
    return sealSectionResult({
      node_id: node.node_id, section_reference: node.reference, source_closure: closure,
      model_calls: [routingCall.call, residualCall.call], routing, residual_pass: residual.residualPass,
      spans: [...closure.spans, ...paragraphs], proposals: [], groups: [], links: [],
      issues: [issue, ...residual.issues], coverage: [...coverage, ...residual.coverage],
    });
  }
  if (routing.families.length === 0) {
    const issues = routing.disposition === 'UNRESOLVED_UNUSUAL_PROVISION'
      ? [makeIssue({ kind: 'COVERAGE', code: 'UNRESOLVED_UNUSUAL_PROVISION', message: routing.rationale || node.reference, nodeId: node.node_id })]
      : [];
    return sealSectionResult({
      node_id: node.node_id,
      section_reference: node.reference,
      source_closure: closure,
      model_calls: [routingCall.call, residualCall.call],
      routing,
      residual_pass: residual.residualPass,
      spans: [...closure.spans, ...paragraphs],
      proposals: [], groups: [], links: [], issues: [...issues, ...residual.issues],
      coverage: [...baseCoverage, sectionCoverage, ...residual.coverage],
    });
  }

  const extractionRequest = {
    instruction: 'Propose atomic legal facts. Every evidence quote must be a contiguous verbatim substring of its declared closure component. Do not add quotation marks, ellipses, omissions or normalisation. Split long support into multiple exact quotes. Each proposal must include at least one evidence quote owned by the analysed section. Definition and cross-reference text from another structure node may qualify or explain an owned fact, but cannot independently create a proposal. Keep conditions, exceptions, thresholds and timing as roles or linked facts. Do not infer absence.',
    source_closure: sourceClosureForModel(closure),
    family_contracts: routing.families.map((key) => familyMap.get(key)),
    response_contract: {
      proposals: [{ client_ref: 'string', group_ref: 'string', family_key: 'string', subtype_key: 'string', fact_type: 'string', statement: 'string', roles: {}, value: 'scalar|null', evidence_quotes: [{ quote: 'exact string', source_span_id: 'closure component span ID', occurrence: 'zero-based integer within that component' }] }],
      groups: [{ client_ref: 'string', family_key: 'string', subtype_key: 'string' }],
      links: [{ from_ref: 'string', to_ref: 'string', relationship_type: RELATIONSHIP_TYPES, source_span_ids: [] }],
      allowed_fact_types_by_family: Object.fromEntries(routing.families.map((key) => [key, familyMap.get(key).required_fact_types])),
      allowed_subtypes_by_family: Object.fromEntries(routing.families.map((key) => [key, familyMap.get(key).subtypes.map((subtype) => subtype.subtype_key)])),
      coverage: Object.fromEntries(routing.families.map((key) => [key, ['FOUND', 'NOT_FOUND', 'UNRESOLVED']])),
      fact_type_coverage: Object.fromEntries(routing.families.map((key) => [key,
        Object.fromEntries(familyMap.get(key).required_fact_types.map((factType) => [factType, ['FOUND', 'NOT_FOUND', 'UNRESOLVED']])),
      ])),
    },
  };
  const extractionCall = await invokeModel(model, {
    kind: 'EXTRACTION', promptVersion: 'PRODUCT_ALL_FAMILY_EXTRACTOR/V2', request: extractionRequest,
    nodeId: node.node_id, attemptToken, onModelCall,
  });
  const compiled = compileExtraction({ sourceDocument, legalSchema, node, closure, call: extractionCall.call, response: extractionCall.response, routedFamilies: routing.families });
  const withoutBase = compiled.coverage.filter((assertion) => assertion.subject_kind !== 'SECTION_FAMILY');
  const familyCoverage = compiled.coverage.filter((assertion) => assertion.subject_kind === 'SECTION_FAMILY');
  return sealSectionResult({
    node_id: node.node_id,
    section_reference: node.reference,
    source_closure: { ...closure, spans: compiled.spans },
    model_calls: [routingCall.call, residualCall.call, extractionCall.call],
    routing,
    residual_pass: residual.residualPass,
    spans: uniqueById([...compiled.spans, ...paragraphs], 'span_id'),
    proposals: compiled.proposals,
    groups: compiled.groups,
    links: compiled.links,
    issues: [...compiled.issues, ...residual.issues],
    coverage: [...baseCoverage.filter((assertion) => !routing.families.includes(assertion.family_key)), ...familyCoverage, ...withoutBase, sectionCoverage, ...residual.coverage],
  });
}

function familyCoverage(legalSchema, proposals, issues, sectionCoverage, routings) {
  const coverage = [];
  const newIssues = [];
  for (const familyKey of TARGET_FAMILIES) {
    const family = legalSchema.families.find((item) => item.family_key === familyKey);
    const familyWasRouted = routings.some((routing) => routing.families.includes(familyKey));
    const factStates = {};
    for (const factType of family.required_fact_types) {
      const states = sectionCoverage.filter((assertion) => assertion.subject_kind === 'FACT_TYPE'
        && assertion.family_key === familyKey && assertion.reason === `FACT_TYPE:${factType}`).map((assertion) => assertion.state);
      if (states.includes('UNRESOLVED')) factStates[factType] = 'UNRESOLVED';
      else if (states.includes('FOUND')) factStates[factType] = 'FOUND';
      else if (states.includes('NOT_FOUND')) factStates[factType] = 'NOT_FOUND';
      else factStates[factType] = familyWasRouted ? 'UNRESOLVED' : 'NOT_FOUND';
    }
    const hasIssues = issues.some((issue) => issue.family_key === familyKey);
    const values = Object.values(factStates);
    const state = hasIssues || values.includes('UNRESOLVED') ? 'UNRESOLVED'
      : values.every((value) => value === 'NOT_FOUND') ? 'NOT_FOUND' : 'FOUND';
    coverage.push(makeCoverage({ subjectKind: 'FAMILY', subjectId: familyKey, state, familyKey, reason: `FACT_TYPE_COVERAGE:${canonicalJson(factStates)}` }));
    for (const [factType, factState] of Object.entries(factStates)) {
      if (factState === 'UNRESOLVED') {
        newIssues.push(makeIssue({ kind: 'COVERAGE', code: 'REQUIRED_FACT_TYPE_UNRESOLVED', message: factType, familyKey }));
      }
    }
  }
  return { coverage, issues: newIssues };
}

function uniqueById(items, key) {
  const byId = new Map();
  for (const item of items) {
    const id = item[key];
    const existing = byId.get(id);
    if (existing && canonicalJson(existing) !== canonicalJson(item)) fail('DRAFT_ID_COLLISION', id);
    byId.set(id, item);
  }
  return [...byId.values()];
}

function assembleAgreementDraft({ sourceDocument, agreementStructure, legalSchema, results }) {
  const modelCalls = uniqueById(results.flatMap((result) => result.model_calls), 'model_call_id');
  const closures = uniqueById(results.map((result) => result.source_closure), 'source_closure_id');
  const spans = uniqueById(results.flatMap((result) => result.spans), 'span_id');
  const proposals = uniqueById(results.flatMap((result) => result.proposals), 'proposal_id');
  const groups = uniqueById(results.flatMap((result) => result.groups), 'proposition_group_id');
  const links = uniqueById(results.flatMap((result) => result.links), 'fact_link_id');
  const sectionIssues = uniqueById(results.flatMap((result) => result.issues), 'issue_id');
  const sectionCoverage = results.flatMap((result) => result.coverage);
  const routings = results.map((result) => result.routing);
  const global = familyCoverage(legalSchema, proposals, sectionIssues, sectionCoverage, routings);
  const issues = uniqueById([...sectionIssues, ...global.issues], 'issue_id');
  const coverage = uniqueById([...sectionCoverage, ...global.coverage], 'coverage_assertion_id');
  const structureId = contentId('AGREEMENT_STRUCTURE/V1', agreementStructure);
  const body = {
    schema_version: DRAFT_VERSION,
    source_document_id: sourceDocument.source_document_id,
    agreement_structure_id: structureId,
    legal_schema_version: legalSchema.schema_version,
    target_families: TARGET_FAMILIES,
    sections: results.map((result) => ({ node_id: result.node_id, section_reference: result.section_reference, section_routing_id: result.routing.section_routing_id, residual_pass_id: result.residual_pass.residual_pass_id, source_closure_id: result.source_closure.source_closure_id })),
    section_routings: routings,
    residual_passes: results.map((result) => result.residual_pass),
    model_calls: modelCalls,
    source_closures: closures,
    spans,
    proposals,
    proposition_groups: groups,
    fact_links: links,
    issues,
    coverage_assertions: coverage,
    totals: {
      substantive_sections: results.length,
      routed_sections: results.filter((result) => result.routing.families.length > 0).length,
      model_calls: modelCalls.length,
      proposals: proposals.length,
      residual_paragraphs: results.reduce((sum, result) => sum + result.residual_pass.dispositions.length, 0),
      unresolved_unusual_provisions: issues.filter((issue) => issue.code === 'UNRESOLVED_UNUSUAL_PROVISION').length,
      open_issues: issues.length,
      cost_microusd: modelCalls.reduce((sum, call) => sum + call.cost_microusd, 0),
      input_tokens: modelCalls.reduce((sum, call) => sum + call.input_tokens, 0),
      output_tokens: modelCalls.reduce((sum, call) => sum + call.output_tokens, 0),
    },
  };
  return deepFreeze({ ...body, draft_analysis_id: contentId(DRAFT_VERSION, body) });
}

async function buildAgreementDraft({
  sourceDocument, agreementStructure, legalSchema, model,
  completedSectionResults = [], onSectionComplete = null,
}) {
  validateLegalSchema(legalSchema);
  const sections = substantiveSections(agreementStructure);
  if (sections.length === 0) fail('SUBSTANTIVE_SECTIONS', 'AgreementStructure has no substantive sections');
  if (!Array.isArray(completedSectionResults)) fail('COMPLETED_SECTION_RESULTS', 'an array is required');
  if (onSectionComplete !== null && typeof onSectionComplete !== 'function') fail('SECTION_CALLBACK', 'onSectionComplete must be a function');
  const completed = new Map(completedSectionResults.map((result) => [result.node_id, result]));
  const results = [];
  for (const node of sections) {
    let result = completed.get(node.node_id);
    if (result) {
      const body = { ...result };
      delete body.section_result_id;
      if (result.schema_version !== SECTION_DRAFT_VERSION
        || contentId(SECTION_DRAFT_VERSION, body) !== result.section_result_id) fail('SECTION_RESULT_IDENTITY', node.node_id);
    } else {
      result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema, model, node });
      if (onSectionComplete) await onSectionComplete(result);
    }
    results.push(result);
  }
  return assembleAgreementDraft({ sourceDocument, agreementStructure, legalSchema, results });
}

function validateAgreementDraft(draft, { sourceDocument, agreementStructure, legalSchema }) {
  validateLegalSchema(legalSchema);
  if (!draft || draft.schema_version !== DRAFT_VERSION) fail('DRAFT_VERSION', 'AGREEMENT_DRAFT/V1 required');
  if (draft.source_document_id !== sourceDocument.source_document_id
    || draft.agreement_structure_id !== contentId('AGREEMENT_STRUCTURE/V1', agreementStructure)
    || draft.legal_schema_version !== legalSchema.schema_version) fail('DRAFT_IDENTITY', 'source, structure or schema mismatch');
  if (draft.sections.length !== substantiveSections(agreementStructure).length) fail('DRAFT_SECTION_COVERAGE', 'every substantive section must be routed');
  const callIds = new Set(draft.model_calls.map((call) => call.model_call_id));
  const spanIds = new Set(draft.spans.map((span) => span.span_id));
  const groupIds = new Set(draft.proposition_groups.map((group) => group.proposition_group_id));
  const proposalIds = new Set(draft.proposals.map((proposal) => proposal.proposal_id));
  const closureIds = new Set(draft.source_closures.map((closure) => closure.source_closure_id));
  const substantive = substantiveSections(agreementStructure);
  const substantiveById = new Map(substantive.map((node) => [node.node_id, node]));
  const assertIdentity = (item, idKey, domain, omit = []) => {
    const body = { ...item };
    delete body[idKey];
    for (const key of omit) delete body[key];
    if (contentId(domain, body) !== item[idKey]) fail('DRAFT_NESTED_IDENTITY', item[idKey]);
  };
  for (const call of draft.model_calls) assertIdentity(call, 'model_call_id', MODEL_CALL_VERSION);
  for (const closure of draft.source_closures) {
    assertIdentity(closure, 'source_closure_id', 'SOURCE_CLOSURE/V1', ['spans']);
    if (closure.source_document_id !== sourceDocument.source_document_id) fail('DRAFT_CLOSURE_SOURCE', closure.source_closure_id);
    const nestedSpanIds = new Set(closure.spans.map((span) => span.span_id));
    const componentIds = [
      ...closure.operative_span_ids,
      ...closure.chapeau_span_ids,
      ...closure.definition_span_ids,
      ...closure.cross_reference_span_ids,
      closure.full_section_span_id,
    ];
    if (closure.spans.some((span) => !spanIds.has(span.span_id))
      || componentIds.some((id) => !nestedSpanIds.has(id))) fail('DRAFT_CLOSURE_MEMBERSHIP', closure.source_closure_id);
    for (const span of closure.spans) {
      const global = draft.spans.find((candidate) => candidate.span_id === span.span_id);
      if (!global || canonicalJson(global) !== canonicalJson(span)) fail('DRAFT_CLOSURE_SPAN', span.span_id);
    }
  }
  const sourceBytes = Buffer.from(sourceDocument.canonical_text, 'utf8');
  for (const span of draft.spans) {
    if (!Number.isSafeInteger(span.start_byte) || !Number.isSafeInteger(span.end_byte)
      || span.start_byte < 0 || span.end_byte <= span.start_byte || span.end_byte > sourceBytes.length) {
      fail('DRAFT_SPAN_RANGE', span.span_id);
    }
    const selected = sourceBytes.subarray(span.start_byte, span.end_byte);
    if (span.source_document_id !== sourceDocument.source_document_id
      || span.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
      || span.exact_text !== selected.toString('utf8')
      || !Buffer.from(span.exact_text, 'utf8').equals(selected)
      || span.text_sha256 !== sha256Hex(selected)
      ) fail('DRAFT_EXACT_SPAN', span.span_id);
    const identity = {
      source_document_id: span.source_document_id,
      kind: span.kind,
      structure_node_id: span.structure_node_id,
      coordinate_system: span.coordinate_system,
      start_byte: span.start_byte,
      end_byte: span.end_byte,
      text_sha256: span.text_sha256,
    };
    if (contentId('PRODUCT_SOURCE_SPAN/V1', identity) !== span.span_id) fail('DRAFT_NESTED_IDENTITY', span.span_id);
  }
  for (const routing of draft.section_routings) {
    assertIdentity(routing, 'section_routing_id', ROUTING_VERSION);
    if (!callIds.has(routing.model_call_id)) fail('DRAFT_ROUTING_CALL', routing.section_routing_id);
  }
  if (!Array.isArray(draft.residual_passes) || draft.residual_passes.length !== substantive.length) {
    fail('DRAFT_RESIDUAL_COVERAGE', 'one paragraph residual pass is required per substantive section');
  }
  for (const residual of draft.residual_passes) {
    assertIdentity(residual, 'residual_pass_id', RESIDUAL_PASS_VERSION);
    const closure = draft.source_closures.find((item) => item.source_closure_id === residual.source_closure_id);
    const closureSpanIds = new Set((closure?.spans || []).map((span) => span.span_id));
    const sectionSpan = closure?.spans.find((span) => span.span_id === closure.full_section_span_id);
    if (!callIds.has(residual.model_call_id) || !closureIds.has(residual.source_closure_id)
      || residual.dispositions.length === 0
      || residual.dispositions.some((item, index) => {
        const span = draft.spans.find((candidate) => candidate.span_id === item.source_span_id);
        return item.paragraph_index !== index || !span || span.kind !== 'RESIDUAL_PARAGRAPH'
          || !closureSpanIds.has(item.source_span_id) || !sectionSpan
          || span.start_byte < sectionSpan.start_byte || span.end_byte > sectionSpan.end_byte;
      })) {
      fail('DRAFT_RESIDUAL_COVERAGE', residual.structure_node_id);
    }
  }
  if (draft.sections.length !== substantive.length || draft.section_routings.length !== substantive.length) {
    fail('DRAFT_SECTION_COVERAGE', 'section and routing counts must match AgreementStructure');
  }
  for (const node of substantive) {
    const sections = draft.sections.filter((section) => section.node_id === node.node_id
      && section.section_reference === node.reference);
    const routings = draft.section_routings.filter((routing) => routing.structure_node_id === node.node_id
      && routing.section_reference === node.reference);
    if (sections.length !== 1 || routings.length !== 1
      || sections[0].section_routing_id !== routings[0].section_routing_id
      || !draft.residual_passes.some((item) => item.residual_pass_id === sections[0].residual_pass_id
        && item.structure_node_id === node.node_id)
      || !closureIds.has(sections[0].source_closure_id)) fail('DRAFT_SECTION_SET', node.node_id);
  }
  if (draft.sections.some((section) => !substantiveById.has(section.node_id))) fail('DRAFT_SECTION_SET', 'unexpected section');
  for (const group of draft.proposition_groups) {
    assertIdentity(group, 'proposition_group_id', GROUP_VERSION);
    if (!closureIds.has(group.source_closure_id)) fail('DRAFT_GROUP_CLOSURE', group.proposition_group_id);
  }
  const familyMap = schemaFamilies(legalSchema);
  for (const proposal of draft.proposals) {
    assertIdentity(proposal, 'proposal_id', PROPOSAL_VERSION);
    if (!callIds.has(proposal.model_call_id) || !groupIds.has(proposal.proposition_group_id)
      || proposal.source_span_ids.some((id) => !spanIds.has(id))) fail('DRAFT_PROPOSAL_GRAPH', proposal.proposal_id);
    const closure = draft.source_closures.find((item) => item.source_closure_id === proposal.source_closure_id);
    const closureSpanIds = new Set(closure ? closure.spans.map((span) => span.span_id) : []);
    if (!closure || proposal.source_span_ids.some((id) => !closureSpanIds.has(id))) fail('DRAFT_PROPOSAL_CLOSURE', proposal.proposal_id);
    const subtype = subtypeContract(familyMap.get(proposal.family_key), proposal.subtype_key);
    if (!familyMap.get(proposal.family_key).required_fact_types.includes(proposal.fact_type)
      || subtype.required_roles.some((role) => proposal.roles[role] === undefined || proposal.roles[role] === null || proposal.roles[role] === '')) {
      if (proposal.validation_status !== 'INVALID') fail('DRAFT_PROPOSAL_VALIDATION', proposal.proposal_id);
    }
  }
  for (const group of draft.proposition_groups) {
    const expected = draft.proposals.filter((proposal) => proposal.proposition_group_id === group.proposition_group_id)
      .map((proposal) => proposal.fact_occurrence_id).sort();
    if (canonicalJson(expected) !== canonicalJson(group.fact_occurrence_ids)) fail('DRAFT_GROUP_MEMBERSHIP', group.proposition_group_id);
  }
  for (const link of draft.fact_links) {
    assertIdentity(link, 'fact_link_id', LINK_VERSION);
    if (!proposalIds.has(link.from_proposal_id) || !proposalIds.has(link.to_proposal_id)
      || !RELATIONSHIP_TYPES.includes(link.relationship_type)
      || link.source_span_ids.some((id) => !spanIds.has(id))) fail('DRAFT_FACT_LINK', link.fact_link_id);
    const from = draft.proposals.find((proposal) => proposal.proposal_id === link.from_proposal_id);
    const to = draft.proposals.find((proposal) => proposal.proposal_id === link.to_proposal_id);
    if (from.source_closure_id !== to.source_closure_id) fail('DRAFT_FACT_LINK_CLOSURE', link.fact_link_id);
    const closure = draft.source_closures.find((item) => item.source_closure_id === from.source_closure_id);
    const closureSpanIds = new Set(closure.spans.map((span) => span.span_id));
    if (link.source_span_ids.some((id) => !closureSpanIds.has(id))) fail('DRAFT_FACT_LINK_CLOSURE', link.fact_link_id);
  }
  for (const issue of draft.issues) assertIdentity(issue, 'issue_id', ISSUE_VERSION);
  for (const assertion of draft.coverage_assertions) {
    assertIdentity(assertion, 'coverage_assertion_id', COVERAGE_VERSION);
    if (!ABSENCE_STATES.includes(assertion.state)
      || (assertion.model_call_id && !callIds.has(assertion.model_call_id))) fail('DRAFT_COVERAGE', assertion.coverage_assertion_id);
  }
  for (const node of substantive) {
    const sectionAssertions = draft.coverage_assertions.filter((item) => item.subject_kind === 'SECTION'
      && item.structure_node_id === node.node_id && item.subject_id === node.node_id);
    if (sectionAssertions.length !== 1) fail('DRAFT_COVERAGE_COMPLETENESS', `${node.reference}:SECTION`);
    for (const familyKey of TARGET_FAMILIES) {
      const familyAssertions = draft.coverage_assertions.filter((item) => item.subject_kind === 'SECTION_FAMILY'
        && item.structure_node_id === node.node_id && item.family_key === familyKey);
      if (familyAssertions.length !== 1) fail('DRAFT_COVERAGE_COMPLETENESS', `${node.reference}:${familyKey}`);
      const routing = draft.section_routings.find((item) => item.structure_node_id === node.node_id);
      for (const factType of routing.families.includes(familyKey) ? familyMap.get(familyKey).required_fact_types : []) {
        const factAssertions = draft.coverage_assertions.filter((item) => item.subject_kind === 'FACT_TYPE'
          && item.structure_node_id === node.node_id && item.family_key === familyKey
          && item.subject_id === `${node.node_id}:${familyKey}:${factType}`);
        if (factAssertions.length !== 1) fail('DRAFT_COVERAGE_COMPLETENESS', `${node.reference}:${familyKey}:${factType}`);
      }
    }
    const residual = draft.residual_passes.find((item) => item.structure_node_id === node.node_id);
    const paragraphAssertions = draft.coverage_assertions.filter((item) => item.subject_kind === 'RESIDUAL_PARAGRAPH'
      && item.structure_node_id === node.node_id);
    if (!residual || paragraphAssertions.length !== residual.dispositions.length) {
      fail('DRAFT_COVERAGE_COMPLETENESS', `${node.reference}:RESIDUAL_PARAGRAPH`);
    }
  }
  for (const familyKey of TARGET_FAMILIES) {
    const assertions = draft.coverage_assertions.filter((item) => item.subject_kind === 'FAMILY'
      && item.family_key === familyKey && item.subject_id === familyKey);
    if (assertions.length !== 1) fail('DRAFT_COVERAGE_COMPLETENESS', `${familyKey}:FAMILY`);
  }
  const body = { ...draft };
  delete body.draft_analysis_id;
  if (contentId(DRAFT_VERSION, body) !== draft.draft_analysis_id) fail('DRAFT_DIGEST', draft.draft_analysis_id);
  return draft;
}

module.exports = {
  AgreementDraftError,
  COVERAGE_VERSION,
  DRAFT_VERSION,
  GROUP_VERSION,
  ISSUE_VERSION,
  LINK_VERSION,
  MODEL_CALL_VERSION,
  PROPOSAL_VERSION,
  RESIDUAL_PASS_VERSION,
  ROUTING_VERSION,
  SECTION_DRAFT_VERSION,
  TARGET_FAMILIES,
  assembleAgreementDraft,
  buildAgreementDraft,
  buildAgreementSectionDraft,
  canonicalLinkSourceSpanIds,
  canonicalProposalSourceSpanIds,
  canonicalRoutingDisagreements,
  canonicalRoutingDisposition,
  canonicalRoutingSet,
  compileRouting,
  compileResidualPass,
  modelInvocationId,
  sealSectionResult,
  validateAgreementDraft,
};
