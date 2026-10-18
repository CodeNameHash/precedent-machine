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

// A draft-level SCHEMA_DRIFT_FACT_TYPE issue (lib/product/agreement-draft.js
// schemaDriftFactTypes) names, in its message, the section whose stored
// extraction requests never mentioned a fact type the schema now requires.
// The page shows one quiet line per entry (Metsera generation 7, 2026-09-14:
// OTHER_DEFINED_TERM_RECORDED joined KEY_DEFINED_TERMS mid-run; 2.01, 2.03,
// 3.02, 3.03, 3.09 and 3.12 were extracted before it). Entries follow the
// agreement's section order, then fact type.
const SCHEMA_DRIFT_CODE = 'SCHEMA_DRIFT_FACT_TYPE';

function parseDriftMessage(message) {
  if (typeof message !== 'string') return null;
  try {
    const parsed = JSON.parse(message);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function schemaDriftEntries(analysis) {
  const nodeOrder = new Map((analysis.agreement_structure?.nodes || []).map((node, index) => [node.node_id, index]));
  const entries = [];
  for (const issue of analysis.issues || []) {
    if (issue.code !== SCHEMA_DRIFT_CODE || issue.structure_node_id != null) continue;
    const message = parseDriftMessage(issue.message);
    if (!message || typeof message.fact_type !== 'string') continue;
    entries.push({
      issue_id: issue.issue_id,
      structure_node_id: message.structure_node_id || null,
      section_reference: message.section_reference || '',
      family_key: issue.family_key || null,
      fact_type: message.fact_type,
    });
  }
  const order = (entry) => (nodeOrder.has(entry.structure_node_id) ? nodeOrder.get(entry.structure_node_id) : Number.MAX_SAFE_INTEGER);
  return entries.sort((left, right) => order(left) - order(right)
    || left.section_reference.localeCompare(right.section_reference, undefined, { numeric: true })
    || left.fact_type.localeCompare(right.fact_type));
}

// Work package 17 (manager, 2026-10-18): a held fact's reason in plain
// words, from the run's issues. The proposal's own INVALID_FACT_COMPONENTS
// issue lists problems by component path ("2: byte range missing"); the
// section's node-level issue of the same code names the quotes that were
// not found ("2: quote not found in source (UNKNOWN_SOURCE_COMPONENT)").
// Each problem becomes the component's words, shortened, and what went
// wrong; the words are never the raw codes.
const PROBLEM_WORDS = [
  [/quote not found in source \(UNKNOWN_SOURCE_COMPONENT\)/i, 'its quote cites a span the section does not have'],
  [/quote not found in source/i, 'its quote was not found in the source'],
  [/byte range missing/i, 'could not be placed in the source text'],
  [/needs a canonical value|no parsable value/i, 'no number could be read from its words'],
  [/invented text/i, 'words that are not in the source'],
  [/inherited component needs origin_structure_node_id/i, 'an inherited component without its origin'],
  [/CROSS_REFERENCE must resolve/i, 'a cross-reference that resolves to nothing'],
];

function parseProblems(message) {
  let parsed = message;
  if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { return [String(message)]; } }
  if (Array.isArray(parsed)) return parsed.map(String);
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.problems)) return parsed.problems.map(String);
  return [String(message)];
}

function componentAtPath(components, path) {
  let list = components || [];
  let found = null;
  for (const index of String(path).split('.').map(Number)) {
    if (!Number.isInteger(index) || !list[index]) return found;
    found = list[index];
    list = found.children || [];
  }
  return found;
}

// Shortened at a word, never mid-word.
function shortenWords(text, limit = 80) {
  const words = String(text || '').replace(/\s+/g, ' ').trim();
  if (words.length <= limit) return words;
  const cut = words.slice(0, limit - 1);
  const atWord = cut.lastIndexOf(' ');
  return `${(atWord > limit / 2 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}

function heldReason(proposal, issues, nodeIssues = []) {
  const unknownSpanPaths = new Set();
  for (const issue of nodeIssues) {
    if (issue?.code !== 'INVALID_FACT_COMPONENTS') continue;
    for (const problem of parseProblems(issue.message)) {
      const match = String(problem).match(/^([\d.]+): quote not found in source \(UNKNOWN_SOURCE_COMPONENT\)/);
      if (match) unknownSpanPaths.add(match[1]);
    }
  }
  const phrases = [];
  for (const issue of issues || []) {
    const problems = issue?.code === 'INVALID_FACT_COMPONENTS' || issue?.code === 'INVENTED_ROLE_TEXT' ? parseProblems(issue.message) : [String(issue?.message || issue?.code || '')];
    for (const problem of problems) {
      const match = String(problem).match(/^([\d.]+):\s*(.*)$/s);
      const path = match ? match[1] : null;
      const detail = match ? match[2] : String(problem);
      const words = (PROBLEM_WORDS.find(([pattern]) => pattern.test(detail)) || [null, detail])[1];
      const unknown = path && unknownSpanPaths.has(path) && /byte range missing/i.test(detail) ? 'its quote cites a span the section does not have' : words;
      const component = path ? componentAtPath(proposal.components, path) : null;
      const phrase = component && component.text ? `“${shortenWords(component.text)}”: ${unknown}` : (issue?.code && !match ? `${String(issue.code).toLowerCase().replace(/_/g, ' ')}: ${shortenWords(detail, 80)}` : unknown);
      if (!phrases.includes(phrase)) phrases.push(phrase);
    }
  }
  return phrases.length ? phrases.join('; ') : 'held by validation';
}

function previewFactsFromWorkspace(workspace) {
  const view = buildReviewView(workspace);
  const spansById = new Map((workspace.analysis.spans || []).map((span) => [span.span_id, span]));
  const facts = [];
  const sectionTextByFactId = new Map();
  const reviewItemsByFactId = new Map();
  let heldCount = 0;
  // Work package 16 (plan finding (85)): the held layered facts, with the
  // words the model wrote, so the election options table can say an
  // option's fact is held rather than that the option is not a feature.
  const heldFacts = [];
  const issuesByProposal = new Map();
  const issuesByNode = new Map();
  for (const issue of workspace.analysis?.issues || []) {
    if (!issue) continue;
    if (issue.proposal_id) { if (!issuesByProposal.has(issue.proposal_id)) issuesByProposal.set(issue.proposal_id, []); issuesByProposal.get(issue.proposal_id).push(issue); }
    if (issue.structure_node_id) { if (!issuesByNode.has(issue.structure_node_id)) issuesByNode.set(issue.structure_node_id, []); issuesByNode.get(issue.structure_node_id).push(issue); }
  }
  for (const section of view.sections) {
    const spanId = section.source_closure?.full_section_span_id || null;
    const sectionText = spanId ? spansById.get(spanId) || null : null;
    for (const entry of section.proposals) {
      const { proposal, review_item: item } = entry;
      const layered = !!proposal.headline && Array.isArray(proposal.components) && proposal.components.length > 0;
      if (!layered) continue;
      if (proposal.validation_status !== 'VALID') {
        heldCount += 1;
        if (item?.decision !== 'REJECTED') {
          heldFacts.push({
            ...proposal, fact_id: proposal.proposal_id, section_reference: section.routing.section_reference,
            held_reason: heldReason(proposal, issuesByProposal.get(proposal.proposal_id) || [], issuesByNode.get(proposal.structure_node_id || section.routing?.structure_node_id) || []),
          });
        }
        continue;
      }
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
    held_facts: heldFacts,
    schema_drift: schemaDriftEntries(workspace.analysis),
  };
}

module.exports = { previewFactsFromWorkspace, schemaDriftEntries, heldReason };
