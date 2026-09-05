'use strict';

function buildReviewView(workspace) {
  const { analysis, review } = workspace;
  const state = review.state;
  const nodes = new Map((analysis.agreement_structure?.nodes || []).map((node) => [node.node_id, node]));
  const decisions = new Map(state.items.map((item) => [item.source_id, item]));
  const proposals = new Map((analysis.proposals || []).map((item) => [item.proposal_id, item]));
  const groups = new Map((analysis.proposition_groups || []).map((item) => [item.proposition_group_id, item]));
  const links = analysis.fact_links || [];
  const projectReviewItem = (item) => item.kind === 'EXCEPTION_LINK' ? {
    ...item,
    relationship_context: {
      from: proposals.get(item.original.from_proposal_id)?.statement || item.original.from_proposal_id,
      to: proposals.get(item.original.to_proposal_id)?.statement || item.original.to_proposal_id,
    },
  } : item;
  const sections = (analysis.sections || []).map((routing) => ({
    node: nodes.get(routing.structure_node_id) || { node_id: routing.structure_node_id, reference: routing.section_reference },
    routing,
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
      && !['PROPOSAL', 'USER_FACT'].includes(item.kind)).map(projectReviewItem),
    coverage: (analysis.coverage_assertions || []).filter((item) => item.structure_node_id === routing.structure_node_id),
    source_closure: (analysis.source_closures || []).find((item) => item.structure_node_id === routing.structure_node_id) || null,
  })).sort((left, right) => (left.node.authored_order || 0) - (right.node.authored_order || 0));
  return {
    sections,
    agreement_items: state.items.filter((item) => !item.structure_node_id).map(projectReviewItem),
    pending_count: state.items.filter((item) => item.decision === 'PENDING').length,
    unresolved_count: state.items.filter((item) => item.decision === 'UNRESOLVED').length,
    residual_paragraph_count: (analysis.coverage_assertions || []).filter((item) => item.subject_kind === 'RESIDUAL_PARAGRAPH').length,
    unusual_provision_count: (analysis.issues || []).filter((item) => item.code === 'UNRESOLVED_UNUSUAL_PROVISION').length,
    can_publish: state.status === 'DRAFT' && state.items.every((item) => !['PENDING', 'UNRESOLVED'].includes(item.decision))
      && state.agreement_coverage.decision === 'ACCEPTED',
  };
}

module.exports = { buildReviewView };
