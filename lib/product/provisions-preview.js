'use strict';

// Lawyer preview of one run in the table layout (mockup approved by Ben
// 2026-09-12/13): every valid layered fact of the draft, across every
// section, laid out as coded conclusions per provision with the evidence
// sidebar behind each pill. Read-only: nothing here decides, comments or
// publishes. The reviewer's edits (edited headline/components) show when
// present, so the preview tracks the review as it progresses.
//
// Pure function over the Review workspace payload (`/api/product/review/:id`)
// so the page body can be rendered and tested without a router or network.

const { buildReviewView } = require('./review-view');

function previewFactsFromWorkspace(workspace) {
  const view = buildReviewView(workspace);
  const spansById = new Map((workspace.analysis.spans || []).map((span) => [span.span_id, span]));
  const facts = [];
  const sectionTextByFactId = new Map();
  const reviewItemsByFactId = new Map();
  let heldCount = 0;
  for (const section of view.sections) {
    const spanId = section.source_closure?.full_section_span_id || null;
    const sectionText = spanId ? spansById.get(spanId) || null : null;
    for (const entry of section.proposals) {
      const { proposal, review_item: item } = entry;
      const layered = !!proposal.headline && Array.isArray(proposal.components) && proposal.components.length > 0;
      if (!layered) continue;
      if (proposal.validation_status !== 'VALID') { heldCount += 1; continue; }
      if (item?.decision === 'REJECTED') continue;
      const fact = {
        ...proposal,
        fact_id: proposal.proposal_id,
        section_reference: section.routing.section_reference,
        statement: item?.edited_statement || proposal.statement,
        headline: item?.edited_headline || proposal.headline,
        components: item?.edited_components || proposal.components,
      };
      facts.push(fact);
      if (sectionText) sectionTextByFactId.set(fact.fact_id, sectionText);
      if (item) reviewItemsByFactId.set(fact.fact_id, item);
    }
  }
  return {
    facts,
    sectionTextByFactId,
    reviewItemsByFactId,
    section_count: view.sections.length,
    held_count: heldCount,
  };
}

module.exports = { previewFactsFromWorkspace };
