'use strict';

const { canonicalJson, contentId, sha256Hex } = require('../canonical-v2/canonical-bytes');
const { RELATIONSHIP_TYPES } = require('./legal-schema');

const CANDIDATE_VERSION = 'PRODUCT_CROSS_SECTION_RELATIONSHIP_CANDIDATE/V1';
const LINK_VERSION = 'PRODUCT_FACT_LINK/V2';
const ISSUE_VERSION = 'PRODUCT_ISSUE/V1';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function rangesOverlap(left, right) {
  return Number.isSafeInteger(left?.start_byte) && Number.isSafeInteger(left?.end_byte)
    && Number.isSafeInteger(right?.start_byte) && Number.isSafeInteger(right?.end_byte)
    && left.start_byte < right.end_byte && right.start_byte < left.end_byte;
}

function rangeContains(container, contained) {
  return Number.isSafeInteger(container?.start_byte) && Number.isSafeInteger(container?.end_byte)
    && Number.isSafeInteger(contained?.start_byte) && Number.isSafeInteger(contained?.end_byte)
    && container.start_byte <= contained.start_byte && container.end_byte >= contained.end_byte;
}

function exactEvidenceSpan(sourceDocument, closure, evidence) {
  if (!sourceDocument || typeof sourceDocument.canonical_text !== 'string'
    || !closure || typeof evidence?.quote !== 'string' || evidence.quote.length === 0
    || typeof evidence.source_span_id !== 'string'
    || !Number.isSafeInteger(evidence.occurrence) || evidence.occurrence < 0) return null;
  const component = (closure.spans || []).find((span) => span.span_id === evidence.source_span_id);
  if (!component) return null;
  const sourceBytes = Buffer.from(sourceDocument.canonical_text, 'utf8');
  const quoteBytes = Buffer.from(evidence.quote, 'utf8');
  const matches = [];
  let cursor = component.start_byte;
  while (cursor <= component.end_byte - quoteBytes.length) {
    const start = sourceBytes.indexOf(quoteBytes, cursor);
    if (start < 0 || start + quoteBytes.length > component.end_byte) break;
    matches.push({ start, end: start + quoteBytes.length });
    cursor = start + Math.max(1, quoteBytes.length);
  }
  const match = matches[evidence.occurrence];
  if (!match) return null;
  const identity = {
    source_document_id: sourceDocument.source_document_id,
    kind: 'SUPPORTING_EVIDENCE',
    structure_node_id: component.structure_node_id,
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte: match.start,
    end_byte: match.end,
    text_sha256: sha256Hex(quoteBytes),
  };
  return deepFreeze({
    schema_version: 'PRODUCT_SOURCE_SPAN/V1',
    span_id: contentId('PRODUCT_SOURCE_SPAN/V1', identity),
    ...identity,
    exact_text: evidence.quote,
  });
}

function subtypeContract(proposal, legalSchema) {
  return legalSchema?.families?.find((family) => (
    family.family_key === proposal?.family_key && family.state === 'DEFINED'
  ))?.subtypes?.find((subtype) => subtype.subtype_key === proposal?.subtype_key) || null;
}

function issueFor(candidate, reason, from, sourceClosures, spanIdsByClosure) {
  const sourceClosureId = from?.source_closure_id || candidate?.source_closure_id || null;
  const closure = sourceClosures.get(sourceClosureId);
  const supplied = Array.isArray(candidate?.source_span_ids) ? candidate.source_span_ids : [];
  const available = spanIdsByClosure.get(sourceClosureId) || new Set();
  const exact = supplied.filter((spanId) => available.has(spanId));
  const sourceSpanIds = exact.length > 0 ? [...new Set(exact)].sort()
    : closure?.full_section_span_id ? [closure.full_section_span_id] : [];
  const body = {
    schema_version: ISSUE_VERSION,
    kind: 'VALIDATION',
    code: 'CROSS_SECTION_RELATIONSHIP_UNRESOLVED',
    message: canonicalJson({ candidate: candidate || null, candidate_id: candidate?.candidate_id || null, reason }),
    family_key: from?.family_key || null,
    subtype_key: from?.subtype_key || null,
    structure_node_id: null,
    proposal_id: from?.proposal_id || null,
    source_closure_id: sourceClosureId,
    source_span_ids: sourceSpanIds,
    state: 'OPEN',
  };
  return deepFreeze({ ...body, issue_id: contentId(ISSUE_VERSION, body) });
}

function resolveCrossSectionRelationshipCandidates({
  candidates, proposals, spans, sourceClosures, legalSchema,
}) {
  const proposalList = Array.isArray(proposals) ? proposals : [];
  const proposalById = new Map(proposalList.map((proposal) => [proposal.proposal_id, proposal]));
  const spanById = new Map((Array.isArray(spans) ? spans : []).map((span) => [span.span_id, span]));
  const closureById = new Map((Array.isArray(sourceClosures) ? sourceClosures : [])
    .map((closure) => [closure.source_closure_id, closure]));
  const spanIdsByClosure = new Map([...closureById].map(([closureId, closure]) => [
    closureId,
    new Set((closure.spans || []).map((span) => span.span_id)),
  ]));
  const links = [];
  const issues = [];

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const from = proposalById.get(candidate?.from_proposal_id);
    const sourceClosure = closureById.get(candidate?.source_closure_id);
    const closureSpanIds = spanIdsByClosure.get(candidate?.source_closure_id);
    const relationshipSpans = Array.isArray(candidate?.source_span_ids)
      ? candidate.source_span_ids.map((spanId) => spanById.get(spanId)) : [];
    const relationshipSourceValid = Boolean(from && sourceClosure && closureSpanIds
      && candidate.source_closure_id === from.source_closure_id
      && candidate.relationship_evidence_complete !== false
      && relationshipSpans.length > 0
      && relationshipSpans.every((span) => span && closureSpanIds.has(span.span_id)
        && span.kind === 'SUPPORTING_EVIDENCE'
        && span.structure_node_id === from.structure_node_id
        && typeof span.exact_text === 'string' && span.exact_text.length > 0));
    if (!relationshipSourceValid) {
      issues.push(issueFor(candidate, 'RELATIONSHIP_SOURCE_NOT_EXACT', from, closureById, spanIdsByClosure));
      continue;
    }
    if (candidate.schema_version !== CANDIDATE_VERSION
      || typeof candidate.candidate_id !== 'string' || candidate.candidate_id.length === 0
      || !from || from.validation_status !== 'VALID'
      || !RELATIONSHIP_TYPES.includes(candidate.relationship_type)) {
      issues.push(issueFor(candidate, 'INVALID_CANDIDATE', from, closureById, spanIdsByClosure));
      continue;
    }
    const subtype = subtypeContract(from, legalSchema);
    if (!subtype?.relationships?.includes(candidate.relationship_type)) {
      issues.push(issueFor(candidate, 'RELATIONSHIP_TYPE_NOT_ALLOWED', from, closureById, spanIdsByClosure));
      continue;
    }
    const target = candidate.target;
    const targetLocatorSpans = Array.isArray(target?.source_span_ids)
      ? target.source_span_ids.map((spanId) => spanById.get(spanId)) : [];
    const targetSourceValid = candidate.target_evidence_complete !== false
      && targetLocatorSpans.length > 0
      && targetLocatorSpans.every((span) => span && closureSpanIds.has(span.span_id)
        && span.kind === 'SUPPORTING_EVIDENCE'
        && span.structure_node_id === target.structure_node_id
        && typeof span.exact_text === 'string' && span.exact_text.length > 0);
    if (!targetSourceValid || target?.structure_node_id === from.structure_node_id) {
      issues.push(issueFor(candidate, 'TARGET_SOURCE_NOT_EXACT', from, closureById, spanIdsByClosure));
      continue;
    }
    const matches = proposalList.filter((proposal) => {
      if (proposal.validation_status !== 'VALID'
        || proposal.structure_node_id !== target.structure_node_id
        || proposal.family_key !== target.family_key
        || proposal.subtype_key !== target.subtype_key
        || proposal.fact_type !== target.fact_type) return false;
      const proposalSpans = (proposal.source_span_ids || []).map((spanId) => spanById.get(spanId))
        .filter(Boolean);
      return targetLocatorSpans.every((locator) => proposalSpans.some((evidence) => (
        evidence.structure_node_id === locator.structure_node_id && rangeContains(evidence, locator)
      )));
    });
    if (matches.length !== 1) {
      issues.push(issueFor(candidate, matches.length === 0 ? 'TARGET_NOT_FOUND' : 'TARGET_AMBIGUOUS', from, closureById, spanIdsByClosure));
      continue;
    }
    const targetProposal = matches[0];
    const body = {
      schema_version: LINK_VERSION,
      from_proposal_id: from.proposal_id,
      to_proposal_id: targetProposal.proposal_id,
      relationship_type: candidate.relationship_type,
      source_closure_id: candidate.source_closure_id,
      source_span_ids: [...new Set(candidate.source_span_ids)].sort(),
      target_source_span_ids: [...new Set(candidate.target.source_span_ids)].sort(),
    };
    links.push(deepFreeze({ ...body, fact_link_id: contentId(LINK_VERSION, body) }));
  }

  return deepFreeze({ links, issues });
}

function resolveRecordedCrossSectionRelationships({ sourceDocument, results, legalSchema }) {
  const proposals = results.flatMap((result) => result.proposals || []);
  const baseSpans = results.flatMap((result) => result.spans || []);
  const sourceClosures = results.map((result) => ({
    ...result.source_closure,
    spans: [...(result.source_closure?.spans || [])],
  }));
  const addedSpans = [];
  const candidates = [];

  for (const result of results) {
    const closure = sourceClosures.find((item) => (
      item.source_closure_id === result.source_closure?.source_closure_id
    ));
    const extractionCalls = (result.model_calls || []).filter((call) => call.call_kind === 'EXTRACTION');
    for (const call of extractionCalls) {
      const response = call.response || {};
      for (const raw of Array.isArray(response.cross_section_links)
        ? response.cross_section_links : []) {
        const rawFrom = (response.proposals || []).filter((item) => item.client_ref === raw?.from_ref);
        const fromEvidence = rawFrom.length === 1 && Array.isArray(rawFrom[0].evidence_quotes)
          ? rawFrom[0].evidence_quotes.map((item) => exactEvidenceSpan(sourceDocument, closure, item))
            .filter(Boolean) : [];
        const fromMatches = rawFrom.length === 1 ? (result.proposals || []).filter((proposal) => (
          proposal.structure_node_id === result.node_id
          && proposal.family_key === rawFrom[0].family_key
          && proposal.subtype_key === rawFrom[0].subtype_key
          && proposal.fact_type === rawFrom[0].fact_type
          && proposal.statement === rawFrom[0].statement
          && fromEvidence.some((locator) => (proposal.source_span_ids || []).some((spanId) => {
            const evidence = [...baseSpans, ...addedSpans].find((span) => span.span_id === spanId);
            return evidence && rangesOverlap(locator, evidence);
          }))
        )) : [];
        const rawRelationshipEvidence = Array.isArray(raw?.evidence_quotes)
          ? raw.evidence_quotes : [];
        const resolvedRelationshipEvidence = rawRelationshipEvidence
          .map((item) => exactEvidenceSpan(sourceDocument, closure, item));
        const relationshipSpans = resolvedRelationshipEvidence.filter(Boolean);
        const rawTargetEvidence = Array.isArray(raw?.target?.evidence_quotes)
          ? raw.target.evidence_quotes : [];
        const resolvedTargetEvidence = rawTargetEvidence
          .map((item) => exactEvidenceSpan(sourceDocument, closure, item));
        const targetSpans = resolvedTargetEvidence.filter(Boolean);
        for (const span of [...relationshipSpans, ...targetSpans]) {
          if (!addedSpans.some((item) => item.span_id === span.span_id)
            && !baseSpans.some((item) => item.span_id === span.span_id)) addedSpans.push(span);
          if (closure && !closure.spans.some((item) => item.span_id === span.span_id)) closure.spans.push(span);
        }
        const candidateBody = {
          schema_version: CANDIDATE_VERSION,
          model_call_id: call.model_call_id,
          from_ref: raw?.from_ref ?? null,
          from_proposal_id: fromMatches.length === 1 ? fromMatches[0].proposal_id : null,
          relationship_type: raw?.relationship_type ?? null,
          source_closure_id: closure?.source_closure_id || null,
          source_span_ids: relationshipSpans.map((span) => span.span_id),
          relationship_evidence_complete: rawRelationshipEvidence.length > 0
            && relationshipSpans.length === rawRelationshipEvidence.length,
          target_evidence_complete: rawTargetEvidence.length > 0
            && targetSpans.length === rawTargetEvidence.length,
          target: {
            structure_node_id: raw?.target?.structure_node_id ?? null,
            family_key: raw?.target?.family_key ?? null,
            subtype_key: raw?.target?.subtype_key ?? null,
            fact_type: raw?.target?.fact_type ?? null,
            source_span_ids: targetSpans.map((span) => span.span_id),
          },
          raw_candidate: raw,
        };
        candidates.push({
          ...candidateBody,
          candidate_id: contentId(CANDIDATE_VERSION, candidateBody),
        });
      }
    }
  }
  const spans = [...new Map([...baseSpans, ...addedSpans].map((span) => [span.span_id, span])).values()];
  const resolved = resolveCrossSectionRelationshipCandidates({
    candidates, proposals, spans, sourceClosures, legalSchema,
  });
  return deepFreeze({
    links: resolved.links,
    issues: resolved.issues,
    spans,
    source_closures: sourceClosures.map((closure) => ({
      ...closure,
      spans: [...new Map(closure.spans.map((span) => [span.span_id, span])).values()],
    })),
  });
}

module.exports = {
  CANDIDATE_VERSION,
  LINK_VERSION,
  resolveRecordedCrossSectionRelationships,
  resolveCrossSectionRelationshipCandidates,
};
