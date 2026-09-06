'use strict';

const { authoredSectionHeading } = require('./review-presentation');

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

function buildReviewView(workspace) {
  const { analysis, review } = workspace;
  const state = review.state;
  const nodes = new Map((analysis.agreement_structure?.nodes || []).map((node) => [node.node_id, node]));
  const decisions = new Map(state.items.map((item) => [item.source_id, item]));
  const proposals = new Map((analysis.proposals || []).map((item) => {
    const decision = decisions.get(item.proposal_id);
    return [item.proposal_id, {
      ...item,
      statement: decision?.edited_statement || item.statement,
    }];
  }));
  for (const item of state.items.filter((candidate) => candidate.kind === 'USER_FACT')) {
    proposals.set(item.source_id, {
      ...item.original,
      statement: item.edited_statement || item.original.statement,
    });
  }
  const groups = new Map((analysis.proposition_groups || []).map((item) => [item.proposition_group_id, item]));
  const links = analysis.fact_links || [];
  const publishedGroupsCoherent = state.items.filter((item) => item.kind === 'PROPOSAL'
    && ['ACCEPTED', 'EDITED'].includes(item.decision)).every((item) => {
    const groupId = Object.hasOwn(item, 'edited_proposition_group_id')
      ? item.edited_proposition_group_id : item.original.proposition_group_id || null;
    if (groupId === null) return true;
    const group = groups.get(groupId);
    return group?.family_key === item.original.family_key
      && group?.subtype_key === item.original.subtype_key;
  });
  const sectionSourceBinding = (item) => {
    const closure = (analysis.source_closures || []).find((candidate) => (
      candidate.structure_node_id === item.structure_node_id
    ));
    const closureSpans = (analysis.spans || []).filter((span) => (
      (span.source_closure_ids || []).includes(closure?.source_closure_id)
    ));
    const preferred = closureSpans.find((span) => (
      span.structure_node_id === item.structure_node_id && span.kind === 'FULL_SECTION'
    )) || closureSpans.find((span) => span.structure_node_id === item.structure_node_id) || closureSpans[0];
    return {
      source_closure_id: item.source_closure_id || closure?.source_closure_id || null,
      source_span_ids: item.source_span_ids?.length ? item.source_span_ids : preferred ? [preferred.span_id] : [],
    };
  };
  const projectReviewItem = (item) => {
    if (['EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP'].includes(item.kind)) {
      const relationship = effectiveRelationship(item);
      return {
      ...item,
      effective_relationship: relationship,
      relationship_context: {
        from: proposals.get(relationship.from_proposal_id)?.statement || relationship.from_proposal_id,
        to: proposals.get(relationship.to_proposal_id)?.statement || relationship.to_proposal_id,
      },
      };
    }
    if (item.kind !== 'ISSUE') return item;
    const source = sectionSourceBinding(item);
    if (item.original.code !== 'GROUP_MEMBER_MISMATCH') return { ...item, ...source };
    const matchingGroupIds = new Set([...groups.values()].filter((group) => (
      group.structure_node_id === item.structure_node_id
      && group.family_key === item.original.family_key
      && group.subtype_key === item.original.subtype_key
    )).map((group) => group.proposition_group_id));
    const memberMappings = [...proposals.values()].filter((proposal) => (
      matchingGroupIds.has(proposal.proposition_group_id)
    )).map((proposal) => ({
      family_key: proposal.family_key,
      subtype_key: proposal.subtype_key,
      statement: proposal.statement,
    })).sort((left, right) => `${left.family_key}\u001f${left.subtype_key}\u001f${left.statement}`
      .localeCompare(`${right.family_key}\u001f${right.subtype_key}\u001f${right.statement}`));
    return {
      ...item,
      ...source,
      issue_context: {
        explanation: 'A proposed fact has a different family or subtype from the relationship group that contains it.',
        group_mapping: { family_key: item.original.family_key, subtype_key: item.original.subtype_key },
        member_mappings: memberMappings,
      },
    };
  };
  const relationshipKinds = new Set(['EXCEPTION_LINK', 'RELATIONSHIP', 'USER_RELATIONSHIP']);
  const sections = (analysis.sections || []).map((routing) => {
    const node = nodes.get(routing.structure_node_id)
      || { node_id: routing.structure_node_id, reference: routing.section_reference };
    const sourceClosure = (analysis.source_closures || []).find((item) => (
      item.structure_node_id === routing.structure_node_id
    )) || null;
    return {
      node,
      routing,
      heading: authoredSectionHeading({ node, routing, sourceClosure, spans: analysis.spans || [] }),
      proposals: [
      ...(analysis.proposals || []).filter((item) => item.structure_node_id === routing.structure_node_id).map((proposal) => ({
        proposal,
        review_item: decisions.get(proposal.proposal_id),
        group: groups.get(proposal.proposition_group_id) || null,
        group_members: (analysis.proposals || []).filter((candidate) => candidate.proposition_group_id === proposal.proposition_group_id),
        related_proposals: links.filter((link) => link.from_proposal_id === proposal.proposal_id || link.to_proposal_id === proposal.proposal_id).map((link) => ({
          link,
          other: proposals.get(link.from_proposal_id === proposal.proposal_id ? link.to_proposal_id : link.from_proposal_id),
          review_item: decisions.get(link.fact_link_id) || null,
        })),
      })),
      ...state.items.filter((item) => item.kind === 'USER_FACT' && item.structure_node_id === routing.structure_node_id).map((item) => ({
        proposal: { ...item.original, proposal_id: item.source_id, structure_node_id: item.structure_node_id },
        review_item: item,
        group: null,
        group_members: [],
        related_proposals: [],
      })),
      ],
      review_items: state.items.filter((item) => item.structure_node_id === routing.structure_node_id
        && !['PROPOSAL', 'USER_FACT'].includes(item.kind)
        && !relationshipKinds.has(item.kind)).map(projectReviewItem),
      coverage: (analysis.coverage_assertions || []).filter((item) => item.structure_node_id === routing.structure_node_id),
      source_closure: sourceClosure,
    };
  }).sort((left, right) => (left.node.authored_order || 0) - (right.node.authored_order || 0));
  return {
    sections,
    fact_items: state.items.filter((item) => ['PROPOSAL', 'USER_FACT'].includes(item.kind)),
    relationship_items: state.items.filter((item) => relationshipKinds.has(item.kind))
      .map(projectReviewItem),
    agreement_items: state.items.filter((item) => !item.structure_node_id).map(projectReviewItem),
    pending_count: state.items.filter((item) => item.decision === 'PENDING').length,
    unresolved_count: state.items.filter((item) => item.decision === 'UNRESOLVED').length,
    residual_paragraph_count: (analysis.coverage_assertions || []).filter((item) => item.subject_kind === 'RESIDUAL_PARAGRAPH').length,
    unusual_provision_count: (analysis.issues || []).filter((item) => item.code === 'UNRESOLVED_UNUSUAL_PROVISION').length,
    can_publish: state.status === 'DRAFT' && state.items.every((item) => !['PENDING', 'UNRESOLVED'].includes(item.decision))
      && state.agreement_coverage.decision === 'ACCEPTED' && publishedGroupsCoherent
      && state.relationship_review_coherent !== false,
  };
}

module.exports = { buildReviewView };
