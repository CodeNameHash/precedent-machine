'use strict';

const { displaySectionReference } = require('./section-reference-display');

const EVIDENCE_REASONS = Object.freeze({
  INVALID_OCCURRENCE: 'The requested quote occurrence is not a valid non-negative whole number.',
  NOT_EXACT_CONTIGUOUS_SOURCE_TEXT: 'The claimed quote is not exact contiguous source text.',
  OUTSIDE_ANALYSED_STRUCTURE_NODE: 'The text belongs to a different agreement section or subclause.',
  OUTSIDE_OWNED_STRUCTURE_NODE: 'The text belongs to a different agreement section or subclause.',
  UNKNOWN_SOURCE_COMPONENT: 'The claimed source component is not in the supplied source closure.',
});

const COMMON_ROLE_HELP = Object.freeze({
  LEGAL_ACTOR_OR_SUBJECT: {
    label: 'Legal actor or subject',
    help: 'Who has the right, duty, status or protection.',
  },
  LEGAL_OPERATION: {
    label: 'Legal operation',
    help: 'What the clause requires, permits, prohibits, states or changes.',
  },
  OPERATIVE_OBJECT: {
    label: 'Operative object',
    help: 'What the legal operation acts on.',
  },
  TEMPORAL_OR_TRIGGER_SCOPE: {
    label: 'Timing or trigger',
    help: 'When the rule applies or what event triggers it.',
  },
  QUALIFICATIONS: {
    label: 'Qualifications',
    help: 'Conditions, exceptions, limits or standards that qualify the rule.',
  },
});

function roleLabel(key) {
  return String(key).toLowerCase().replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function commonRoleHelp(key) {
  return COMMON_ROLE_HELP[key] || { label: roleLabel(key), help: null };
}

function readableEvidenceReason(reason) {
  if (!reason) return 'No exact source citation was recorded.';
  return EVIDENCE_REASONS[reason]
    || `${String(reason).toLowerCase().replaceAll('_', ' ')}.`;
}

function evidenceSectionReference(evidence, nodesById) {
  const node = nodesById.get(evidence.component_structure_node_id);
  return node?.reference ? displaySectionReference(node.reference) : 'Section reference unavailable';
}

function presentEvidenceItem(evidence, nodesById, kind) {
  const reason = kind === 'CONTEXT_ONLY' && !evidence.reason
    ? 'The text belongs to a different agreement section or subclause.'
    : readableEvidenceReason(evidence.reason);
  const sectionReference = evidenceSectionReference(evidence, nodesById);
  return {
    category: kind === 'UNMATCHED'
      ? 'Claimed quote did not match the source'
      : 'Supporting context outside the owned section',
    quote: evidence.quote,
    reason,
    source_span_id: evidence.source_span_id,
    ...(evidence.fallback_source_span_id
      ? { fallback_source_span_id: evidence.fallback_source_span_id } : {}),
    section_reference: sectionReference,
    component_kind: evidence.component_kind,
    source_context: {
      kind,
      attempted_quote: evidence.quote,
      reason,
      section_reference: sectionReference,
    },
  };
}

function presentReviewEvidence(proposal, nodes = []) {
  const nodesById = new Map(nodes.map((node) => [node.node_id, node]));
  return {
    unmatched: (proposal.unmatched_evidence || [])
      .map((evidence) => presentEvidenceItem(evidence, nodesById, 'UNMATCHED')),
    contextOnly: (proposal.context_only_evidence || [])
      .map((evidence) => presentEvidenceItem(evidence, nodesById, 'CONTEXT_ONLY')),
  };
}

function isOwnedStructureNode(nodesById, ownedStructureNodeId, candidateNodeId) {
  if (!ownedStructureNodeId || !candidateNodeId) return false;
  const visited = new Set();
  let currentId = candidateNodeId;
  while (currentId && !visited.has(currentId)) {
    if (currentId === ownedStructureNodeId) return true;
    visited.add(currentId);
    currentId = nodesById.get(currentId)?.parent_id;
  }
  return false;
}

function presentCitationChoices({
  spans = [], nodes = [], ownedStructureNodeId, selectedIds = [], filter = '',
}) {
  const nodesById = new Map(nodes.map((node) => [node.node_id, node]));
  const selected = new Set(selectedIds);
  const query = filter.trim().toLowerCase();
  return spans.map((span) => {
    const node = nodesById.get(span.structure_node_id);
    const owned = isOwnedStructureNode(nodesById, ownedStructureNodeId, span.structure_node_id);
    const choice = {
      span_id: span.span_id,
      kind: span.kind,
      exact_text: span.exact_text,
      section_reference: node?.reference
        ? displaySectionReference(node.reference) : 'Section reference unavailable',
      ownership_label: owned ? 'Owned section or subclause' : 'Supporting context',
      breadth_label: span.kind === 'FULL_SECTION' ? 'Broad full section' : 'Source passage',
      selected: selected.has(span.span_id),
    };
    return { choice, owned, broad: span.kind === 'FULL_SECTION', start: span.start_byte ?? 0 };
  }).filter(({ choice }) => {
    if (!query || choice.selected) return true;
    return [choice.exact_text, choice.kind, choice.section_reference, choice.ownership_label]
      .some((value) => String(value).toLowerCase().includes(query));
  }).sort((left, right) => Number(right.owned) - Number(left.owned)
    || Number(left.broad) - Number(right.broad)
    || left.choice.exact_text.length - right.choice.exact_text.length
    || left.start - right.start
    || left.choice.span_id.localeCompare(right.choice.span_id))
    .map(({ choice }) => choice);
}

function primaryProposalSource(savedSourceSpanIds, reviewEvidence) {
  if (savedSourceSpanIds.length > 0) {
    return { spanId: savedSourceSpanIds[0], reviewContext: null };
  }
  const evidence = reviewEvidence.unmatched[0] || reviewEvidence.contextOnly[0] || null;
  return {
    spanId: evidence?.fallback_source_span_id || evidence?.source_span_id,
    reviewContext: evidence?.source_context || null,
  };
}

function proposalRepairState({ proposal, savedRoles, requiredRoleKeys, savedSourceSpanIds }) {
  const missingRequiredRoles = requiredRoleKeys.filter((key) => (
    savedRoles?.[key] === undefined || savedRoles[key] === null || savedRoles[key] === ''
  )).map((key) => ({ key, ...commonRoleHelp(key) }));
  const hasUnmatchedEvidence = (proposal.unmatched_evidence || []).length > 0;
  return {
    hasUnmatchedEvidence,
    needsCitationSelection: savedSourceSpanIds.length === 0,
    citationRepairGuidanceRequired: hasUnmatchedEvidence || savedSourceSpanIds.length === 0,
    missingRequiredRoles,
  };
}

module.exports = {
  commonRoleHelp,
  primaryProposalSource,
  presentCitationChoices,
  presentReviewEvidence,
  proposalRepairState,
  readableEvidenceReason,
};
