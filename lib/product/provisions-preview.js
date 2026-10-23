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

// Work package 18 (e) as revised (2026-10-18): an exhibit that is a separate
// agreement (Metsera's Form CVR Agreement) is out of scope; the draft holds
// one OUT_OF_SCOPE_EXHIBIT note on its node and the page lists it under a
// quiet "Out of scope" line. Ben: "For CVRs - I want to build a separate
// product for that os I'd leave those".
const OUT_OF_SCOPE_CODE = 'OUT_OF_SCOPE_EXHIBIT';

function outOfScopeEntries(analysis) {
  const nodeOrder = new Map((analysis.agreement_structure?.nodes || []).map((node, index) => [node.node_id, index]));
  const entries = [];
  for (const issue of analysis.issues || []) {
    if (issue.code !== OUT_OF_SCOPE_CODE) continue;
    const message = parseDriftMessage(issue.message) || {};
    entries.push({
      issue_id: issue.issue_id,
      structure_node_id: issue.structure_node_id || null,
      section_reference: message.section_reference || '',
      title: typeof message.title === 'string' ? message.title : '',
    });
  }
  return entries.sort((left, right) => (
    (nodeOrder.get(left.structure_node_id) ?? Number.MAX_SAFE_INTEGER) - (nodeOrder.get(right.structure_node_id) ?? Number.MAX_SAFE_INTEGER)
    || String(left.section_reference).localeCompare(String(right.section_reference))
  ));
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

// Work package 27 (plan finding (237), 2026-10-23). Ben, on where a held
// fact goes when it has no home: "I think a section at the bottom of the
// page (if not section understood for the facts) or a at the bottom of the
// relevant section (e.g. termination) for those without a home". On the
// Apogee 88d4032a preview read at 62 of 97 (538 valid facts, 9 held), 3.3's
// two held facts read "held by validation": DUPLICATE_FACT_OCCURRENCE is
// written on the node (proposal_id null), not on either proposal, so each
// proposal named in its message is given that issue here, at read time.
// The issue store and the issue code are not changed; heldReason reads the
// rule's own words from it.
function nodeIssueHeldProposal(issue, proposal) {
  if (!issue || issue.proposal_id) return false;
  if (issue.kind && issue.kind !== 'VALIDATION') return false;
  const message = parseDriftMessage(issue.message);
  if (!message) return false;
  if (typeof message.proposal_id === 'string' && message.proposal_id === proposal.proposal_id) return true;
  for (const candidate of Array.isArray(message.candidates) ? message.candidates : []) {
    if (!candidate) continue;
    if (candidate.proposal_id === proposal.proposal_id) return true;
    if (proposal.fact_occurrence_id && candidate.fact_occurrence_id === proposal.fact_occurrence_id) return true;
  }
  return false;
}

// The rule's own words, quoted as the issue code in plain words, for a
// code whose message is a JSON object rather than a component path. Never
// invent a meaning the code does not carry.
const RULE_REASON_WORDS = {
  DUPLICATE_FACT_OCCURRENCE: 'duplicate fact occurrence',
};

function heldReason(proposal, issues, nodeIssues = []) {
  const heldIssues = [...(issues || [])];
  for (const issue of nodeIssues || []) {
    if (nodeIssueHeldProposal(issue, proposal) && !heldIssues.includes(issue)) heldIssues.push(issue);
  }
  const unknownSpanPaths = new Set();
  for (const issue of nodeIssues) {
    if (issue?.code !== 'INVALID_FACT_COMPONENTS') continue;
    for (const problem of parseProblems(issue.message)) {
      const match = String(problem).match(/^([\d.]+): quote not found in source \(UNKNOWN_SOURCE_COMPONENT\)/);
      if (match) unknownSpanPaths.add(match[1]);
    }
  }
  const phrases = [];
  for (const issue of heldIssues) {
    const problems = issue?.code === 'INVALID_FACT_COMPONENTS' || issue?.code === 'INVENTED_ROLE_TEXT' ? parseProblems(issue.message) : [String(issue?.message || issue?.code || '')];
    for (const problem of problems) {
      const match = String(problem).match(/^([\d.]+):\s*(.*)$/s);
      const path = match ? match[1] : null;
      const detail = match ? match[2] : String(problem);
      const words = (PROBLEM_WORDS.find(([pattern]) => pattern.test(detail)) || [null, detail])[1];
      const unknown = path && unknownSpanPaths.has(path) && /byte range missing/i.test(detail) ? 'its quote cites a span the section does not have' : words;
      const component = path ? componentAtPath(proposal.components, path) : null;
      const ruleWords = issue?.code ? RULE_REASON_WORDS[issue.code] : null;
      const phrase = ruleWords || (component && component.text
        ? `“${shortenWords(component.text)}”: ${unknown}`
        : (issue?.code && !match ? `${String(issue.code).toLowerCase().replace(/_/g, ' ')}: ${shortenWords(detail, 80)}` : unknown));
      if (!phrases.includes(phrase)) phrases.push(phrase);
    }
  }
  return phrases.length ? phrases.join('; ') : 'held by validation';
}

// Work package 27: the components' words, shortened, for a held fact the
// page has no table block for. One line, so a lawyer can identify the fact
// even when its headline summary is missing.
function componentSummaryText(components) {
  const words = (Array.isArray(components) ? components : [])
    .map((component) => (component && typeof component.text === 'string' ? component.text.trim() : ''))
    .filter(Boolean);
  return shortenWords(words.join(' · '), 180);
}

// The page renders a fact through table-view.js and the evidence sidebar;
// these are the only fields it reads. The read path already projects the
// stored proposals (lib/product/preview-handler.js), and building the fact
// from the same list keeps this module's output independent of the fields
// the run carries that the page never renders. The component projection
// mirrors the handler's: the empty defaults the page reads as absent are
// not passed through.
const FACT_FIELDS = [
  'proposal_id', 'structure_node_id', 'family_key', 'subtype_key', 'validation_status',
  'conclusions', 'coverage_only', 'fact_occurrence_id',
];
const COMPONENT_FIELDS = [
  'component_id', 'kind', 'label', 'text', 'origin', 'source_span_id', 'start_byte', 'end_byte',
  'gap_before', 'children', 'members', 'value', 'resolves_to', 'origin_structure_node_id',
];
const SECTION_TEXT_FIELDS = ['span_id', 'exact_text', 'start_byte'];

function projectComponent(component) {
  if (!component || typeof component !== 'object') return component;
  const projected = {};
  for (const field of COMPONENT_FIELDS) {
    if (!Object.hasOwn(component, field)) continue;
    const value = component[field];
    if (field === 'gap_before' && value === false) continue;
    if (['members', 'value', 'resolves_to', 'origin_structure_node_id', 'start_byte', 'end_byte'].includes(field) && value === null) continue;
    if (field === 'children' && Array.isArray(value) && value.length === 0) continue;
    projected[field] = field === 'children' ? value.map(projectComponent) : value;
  }
  return projected;
}

function previewFact(proposal, { sectionReference, statement, headline, components, heldReason = null }) {
  const fact = { fact_id: proposal.proposal_id, section_reference: sectionReference };
  for (const field of FACT_FIELDS) {
    if (Object.hasOwn(proposal, field)) fact[field] = proposal[field];
  }
  fact.statement = statement;
  if (headline !== undefined) fact.headline = headline;
  if (Array.isArray(components)) fact.components = components.map(projectComponent);
  else if (components !== undefined) fact.components = components;
  if (heldReason !== null) fact.held_reason = heldReason;
  return fact;
}

function previewSectionText(span) {
  if (!span || typeof span !== 'object') return span;
  const projected = {};
  for (const field of SECTION_TEXT_FIELDS) {
    if (Object.hasOwn(span, field)) projected[field] = span[field];
  }
  return projected;
}

function previewFactsFromWorkspace(workspace) {
  const view = buildReviewView(workspace);
  const spansById = new Map((workspace.analysis.spans || []).map((span) => [span.span_id, previewSectionText(span)]));
  const nodesById = new Map((workspace.analysis.agreement_structure?.nodes || []).map((node) => [node.node_id, node]));
  const facts = [];
  const sectionTextByFactId = new Map();
  const reviewItemsByFactId = new Map();
  let heldCount = 0;
  // Work package 16 (plan finding (85)): the held layered facts, with the
  // words the model wrote, so the election options table can say an
  // option's fact is held rather than that the option is not a feature.
  const heldFacts = [];
  // Work package 27 (plan finding (237)): a held fact whose structure node
  // is null, or whose section did not load, reaches no section block. It
  // goes to the page-bottom list instead, naming its section where the
  // structure knows it. The two lists are disjoint: every proposal is read
  // from its loaded section when it has one, and only the rest land here.
  const unplacedHeld = [];
  const placedProposalIds = new Set();
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
      placedProposalIds.add(proposal.proposal_id);
      const layered = !!proposal.headline && Array.isArray(proposal.components) && proposal.components.length > 0;
      if (!layered) continue;
      if (proposal.validation_status !== 'VALID') {
        heldCount += 1;
        if (item?.decision !== 'REJECTED') {
          heldFacts.push(previewFact(proposal, {
            sectionReference: section.routing.section_reference,
            statement: proposal.statement,
            headline: proposal.headline,
            components: proposal.components,
            heldReason: heldReason(proposal, issuesByProposal.get(proposal.proposal_id) || [], issuesByNode.get(proposal.structure_node_id || section.routing?.structure_node_id) || []),
          }));
        }
        continue;
      }
      if (item?.decision === 'REJECTED') continue;
      const fact = previewFact(proposal, {
        sectionReference: section.routing.section_reference,
        statement: item?.edited_statement || proposal.statement,
        headline: item?.edited_headline || proposal.headline,
        components: item?.edited_components || proposal.components,
      });
      facts.push(fact);
      if (sectionText) sectionTextByFactId.set(fact.fact_id, sectionText);
      if (item) reviewItemsByFactId.set(fact.fact_id, item);
    }
  }
  for (const proposal of workspace.analysis?.proposals || []) {
    if (!proposal || !proposal.proposal_id || placedProposalIds.has(proposal.proposal_id)) continue;
    const layered = !!proposal.headline && Array.isArray(proposal.components) && proposal.components.length > 0;
    if (!layered) continue;
    // Only a non-VALID fact is held; a VALID fact that reached no loaded
    // section is not silently counted as held, and an INVALID one is never
    // offered as a fact of the page.
    if (proposal.validation_status === 'VALID') continue;
    heldCount += 1;
    const item = (workspace.review?.state?.items || []).find((candidate) => (
      candidate && candidate.source_id === proposal.proposal_id && ['PROPOSAL', 'USER_FACT'].includes(candidate.kind)
    ));
    if (item?.decision === 'REJECTED') continue;
    const node = proposal.structure_node_id ? nodesById.get(proposal.structure_node_id) || null : null;
    unplacedHeld.push({
      fact_id: proposal.proposal_id,
      reason: heldReason(proposal, issuesByProposal.get(proposal.proposal_id) || [], issuesByNode.get(proposal.structure_node_id) || []),
      section_reference: (node && node.reference) || proposal.section_reference || null,
      structure_node_id: proposal.structure_node_id || null,
      statement: typeof proposal.statement === 'string' ? proposal.statement : null,
      summary: typeof proposal.headline?.summary === 'string' ? proposal.headline.summary : null,
      components_summary: componentSummaryText(proposal.components),
    });
  }
  const nodeOrder = new Map((workspace.analysis.agreement_structure?.nodes || []).map((node, index) => [node.node_id, index]));
  unplacedHeld.sort((left, right) => (
    (nodeOrder.get(left.structure_node_id) ?? Number.MAX_SAFE_INTEGER) - (nodeOrder.get(right.structure_node_id) ?? Number.MAX_SAFE_INTEGER)
    || String(left.section_reference || '').localeCompare(String(right.section_reference || ''), undefined, { numeric: true })
    || String(left.fact_id).localeCompare(String(right.fact_id))
  ));
  return {
    facts,
    sectionTextByFactId,
    reviewItemsByFactId,
    section_count: view.sections.length,
    held_count: heldCount,
    held_facts: heldFacts,
    unplaced_held: unplacedHeld,
    schema_drift: schemaDriftEntries(workspace.analysis),
    out_of_scope: outOfScopeEntries(workspace.analysis),
  };
}

module.exports = { previewFactsFromWorkspace, schemaDriftEntries, heldReason };
